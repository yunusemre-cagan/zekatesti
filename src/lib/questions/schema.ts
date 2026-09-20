/**
 * Soru veri modeli — tek doğruluk kaynağı.
 *
 * Bu dosyadaki Zod şemalarından:
 *  - TypeScript tipleri (`Question`, `SingleChoiceQuestion`, ...) türetilir,
 *  - `data/questions.json` okunurken içerik doğrulanır,
 *  - admin panelinde kaydetmeden önce form verisi doğrulanır.
 *
 * Böylece tip, doğrulama ve veri formatı hiçbir zaman birbirinden kopamaz.
 *
 * Soru tipleri "type" alanına göre ayrışan bir discriminated union olarak modellenir:
 *  - single_choice   : Tek doğru şık (örüntü, matris, mantık, analoji, problem çözme ...)
 *  - multi_choice    : Birden fazla doğru şık (ör. "hangileri aynı cismin döndürülmüş hali?")
 *  - memory_sequence : Dizi gösterilir, gizlenir, kullanıcı belirli bir dönüşümle yazar
 *  - speed_task      : Süreli, çok maddeli eşleştirme görevi (kısmi puanlı)
 *
 * Kullanım: repository.ts (dosya doğrulama), sanitize.ts, puanlama modülleri, API route'ları
 * ve admin paneli formu bu şemaları ve türetilmiş tipleri kullanır.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Sabit listeler
// ---------------------------------------------------------------------------

/**
 * Soru kategorileri. Kategori, sonuç ekranındaki "kategori bazlı başarı" dökümünü belirler;
 * soru tipi (type) ise sorunun nasıl gösterileceğini ve puanlanacağını belirler.
 * Bu ikisi bilinçli olarak ayrıdır: örneğin "sayısal örüntü" ve "sözel analoji" farklı
 * kategorilerdir ama ikisi de `single_choice` tipindedir.
 */
export const QUESTION_CATEGORIES = [
  "numeric_pattern",
  "visual_matrix",
  "logical_deduction",
  "verbal_analogy",
  "spatial_reasoning",
  "working_memory",
  "problem_solving",
  "processing_speed",
  "odd_one_out",
  "coding_decoding",
  "paper_folding",
  "figure_series",
] as const;

export const QUESTION_TYPES = [
  "single_choice",
  "multi_choice",
  "open_answer",
  "memory_sequence",
  "nback_task",
  "speed_task",
] as const;

/** Açık uçlu cevabın nasıl karşılaştırılacağı: sayı olarak mı, metin olarak mı. */
export const ANSWER_FORMATS = ["number", "text"] as const;

/** Bellek sorusunda kullanıcıdan beklenen dönüşüm. */
export const MEMORY_TRANSFORMS = ["same", "reverse", "sorted"] as const;

// ---------------------------------------------------------------------------
// Temel (yeniden kullanılan) şemalar
// ---------------------------------------------------------------------------

/**
 * Soru kimliği: küçük harf, rakam ve tire (ör. "numeric-pattern-01").
 * URL ve klasör adı olarak (public/questions/<id>/) güvenle kullanılabilmesi için kısıtlıdır.
 */
export const questionIdSchema = z
  .string()
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Kimlik yalnızca küçük harf, rakam ve tire içerebilir.");

/**
 * Görsel yolu: `public/` klasörüne göre mutlak web yolu (ör. "/questions/matrix-01/a.svg").
 * Yalnızca `/questions/` altına ve bilinen görsel uzantılarına izin verilir; böylece
 * veri dosyası üzerinden rastgele bir yola/dosyaya referans verilemez.
 */
export const imagePathSchema = z
  .string()
  .regex(
    /^\/questions\/[a-z0-9-]+\/[A-Za-z0-9._-]+\.(svg|png|jpe?g|webp|gif)$/,
    "Görsel yolu /questions/<klasör>/<dosya>.(svg|png|jpg|jpeg|webp|gif) biçiminde olmalı.",
  );

const nonEmptyText = z.string().trim().min(1);

/**
 * Metin ve/veya görselden oluşan içerik parçası.
 * Şıklar, hız görevi maddeleri ve lejant sembolleri bu yapıyı kullanır.
 */
export const mediaSchema = z
  .object({
    text: nonEmptyText.optional(),
    image: imagePathSchema.optional(),
  })
  .refine((media) => media.text !== undefined || media.image !== undefined, {
    message: "Metin veya görselden en az biri dolu olmalı.",
  });

/** Bir şık: kısa bir kimlik ("a", "b" ...) + metin/görsel içeriği. */
export const optionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]{1,8}$/, "Şık kimliği kısa ve alfanümerik olmalı (ör. 'a')."),
    text: nonEmptyText.optional(),
    image: imagePathSchema.optional(),
  })
  .refine((option) => option.text !== undefined || option.image !== undefined, {
    message: "Şıkta metin veya görselden en az biri dolu olmalı.",
  });

const optionListSchema = z
  .array(optionSchema)
  .min(2, "En az 2 şık olmalı.")
  .max(8, "En fazla 8 şık olabilir.")
  .refine((options) => hasUniqueValues(options.map((o) => o.id)), {
    message: "Şık kimlikleri benzersiz olmalı.",
  });

/**
 * Tüm soru tiplerinde ortak olan alanlar.
 *
 * Kimlik ayrı tutulur ve her soru şemasında `id → type → diğerleri` sırasıyla birleştirilir;
 * böylece JSON dosyasına yazılan alan sırası okunabilir olur (Zod, çıktıyı şemadaki sırayla üretir).
 */
const identityShape = {
  id: questionIdSchema,
};

const baseQuestionShape = {
  category: z.enum(QUESTION_CATEGORIES),
  /** 1 = kolay, 2 = orta, 3 = zor. Puanlamada ağırlık olarak da kullanılır. */
  difficulty: z.literal([1, 2, 3]),
  prompt: nonEmptyText,
  promptImage: imagePathSchema.optional(),
  /**
   * Bu soru için beklenen çözüm süresi (saniye). Girilmezse zorluğa göre varsayılan kullanılır
   * (bkz. config.ts → QUESTION_TIME). Puanlamada hız çarpanının temelidir.
   */
  expectedSec: z.int().min(5).max(600).optional(),
  /** Sonuç ekranında gösterilen çözüm açıklaması. */
  explanation: nonEmptyText.optional(),
  /** Pasif sorular teste dahil edilmez ama veride kalır. */
  active: z.boolean(),
};

// ---------------------------------------------------------------------------
// Soru tipleri
// ---------------------------------------------------------------------------

export const singleChoiceQuestionSchema = z
  .object({
    ...identityShape,
    type: z.literal("single_choice"),
    ...baseQuestionShape,
    options: optionListSchema,
    correctOptionId: z.string(),
  })
  .refine((q) => q.options.some((o) => o.id === q.correctOptionId), {
    message: "Doğru şık, şıklar arasında bulunmalı.",
    path: ["correctOptionId"],
  });

export const multiChoiceQuestionSchema = z
  .object({
    ...identityShape,
    type: z.literal("multi_choice"),
    ...baseQuestionShape,
    options: optionListSchema,
    correctOptionIds: z.array(z.string()).min(1, "En az bir doğru şık seçilmeli."),
  })
  .refine((q) => hasUniqueValues(q.correctOptionIds), {
    message: "Doğru şıklar tekrar etmemeli.",
    path: ["correctOptionIds"],
  })
  .refine((q) => q.correctOptionIds.every((id) => q.options.some((o) => o.id === id)), {
    message: "Tüm doğru şıklar, şıklar arasında bulunmalı.",
    path: ["correctOptionIds"],
  });

export const memorySequenceQuestionSchema = z.object({
  ...identityShape,
  type: z.literal("memory_sequence"),
  ...baseQuestionShape,
  /**
   * Sırayla gösterilecek öğeler. Tek karakterlik rakam/harf tutulur; böylece kullanıcı
   * cevabı ayraç kullanmadan tek satırda yazabilir ve karşılaştırma belirsiz olmaz.
   */
  sequence: z
    .array(z.string().regex(/^[0-9A-Z]$/, "Dizi öğeleri tek rakam veya büyük harf olmalı."))
    .min(3, "Dizi en az 3 öğe içermeli.")
    .max(12, "Dizi en fazla 12 öğe içerebilir."),
  /** Her bir öğenin ekranda kalma süresi (ms). */
  itemDisplayMs: z.int().min(300).max(5000),
  /** Kullanıcının diziyi hangi biçimde yazması gerektiği. Beklenen cevap bundan hesaplanır. */
  transform: z.enum(MEMORY_TRANSFORMS),
});

/** Hız görevindeki tek bir madde: gösterilen uyaran + doğru şık. */
export const speedTaskItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,16}$/),
  stimulus: mediaSchema,
  correctOptionId: z.string(),
});

export const speedTaskQuestionSchema = z
  .object({
    ...identityShape,
    type: z.literal("speed_task"),
    ...baseQuestionShape,
    /** Görev için ayrılan süre (saniye). Süre bitince görev otomatik tamamlanır. */
    timeLimitSec: z.int().min(10).max(300),
    /**
     * İsteğe bağlı anahtar tablo (ör. ★ = 1, ● = 2). Sembol-rakam kodlama görevlerinde
     * görev boyunca ekranda gösterilir.
     */
    legend: z
      .array(z.object({ symbol: mediaSchema, label: nonEmptyText }))
      .optional(),
    /**
     * Tüm maddeler için ortak şıklar. Hız görevlerinde kullanıcı her maddede aynı
     * seçenek setinden seçim yapar; bu, hem arayüzü hızlandırır hem de veri girişini sadeleştirir.
     */
    options: optionListSchema,
    items: z.array(speedTaskItemSchema).min(3).max(30),
  })
  .refine((q) => hasUniqueValues(q.items.map((item) => item.id)), {
    message: "Madde kimlikleri benzersiz olmalı.",
    path: ["items"],
  })
  .refine(
    (q) => q.items.every((item) => q.options.some((o) => o.id === item.correctOptionId)),
    { message: "Her maddenin doğru şıkkı, ortak şıklar arasında bulunmalı.", path: ["items"] },
  );

/**
 * Açık uçlu soru: şık yoktur, kullanıcı cevabı kendisi yazar.
 *
 * Tahmin ihtimalini ortadan kaldırdığı için aynı içerik şıklı haline göre belirgin şekilde
 * zordur. Birden fazla kabul edilen cevap yazılabilir (ör. "33" ve "otuz üç"); karşılaştırma
 * `answerFormat` alanına göre normalize edilerek yapılır (bkz. scoring/check-answer.ts).
 */
export const openAnswerQuestionSchema = z.object({
  ...identityShape,
  type: z.literal("open_answer"),
  ...baseQuestionShape,
  answerFormat: z.enum(ANSWER_FORMATS),
  /** Doğru sayılan cevaplar. En az biri girilmelidir. */
  acceptedAnswers: z
    .array(nonEmptyText)
    .min(1, "En az bir kabul edilen cevap girilmeli.")
    .max(5, "En fazla 5 kabul edilen cevap girilebilir."),
  /** Cevap kutusunda gösterilecek ipucu metni (ör. "Örn: 42"). */
  placeholder: nonEmptyText.optional(),
});

/**
 * n-back görevi: ekranda tek tek akan öğelerde, "şu anki öğe n adım öncekiyle aynı mı?"
 * sorusu her adımda yanıtlanır.
 *
 * Dizi ezberlemeye değil, sürekli güncellenen bir belleği tutmaya dayandığı için çalışma
 * belleğini dizi sorularından daha zorlu ölçer. Doğru cevaplar (eşleşme konumları) veride
 * tutulmaz; diziden hesaplanır.
 */
export const nbackQuestionSchema = z
  .object({
    ...identityShape,
    type: z.literal("nback_task"),
    ...baseQuestionShape,
    /** Kaç adım öncesiyle karşılaştırılacağı (2 = "iki önceki"). */
    n: z.int().min(1).max(3),
    /** Akacak öğeler; tek karakterlik harf veya rakam. */
    sequence: z
      .array(z.string().regex(/^[0-9A-Z]$/, "Öğeler tek rakam veya büyük harf olmalı."))
      .min(8, "Dizi en az 8 öğe içermeli.")
      .max(40, "Dizi en fazla 40 öğe içerebilir."),
    /** Her öğenin ekranda kalma süresi (ms). */
    itemDisplayMs: z.int().min(800).max(4000),
  })
  .refine((q) => countNbackTargets(q.sequence, q.n) >= 2, {
    message: "Dizi en az iki eşleşme içermeli; aksi halde görev ölçüm yapamaz.",
    path: ["sequence"],
  });

/** Herhangi bir soru — "type" alanına göre doğru şemaya yönlendirilir. */
export const questionSchema = z.discriminatedUnion("type", [
  singleChoiceQuestionSchema,
  multiChoiceQuestionSchema,
  openAnswerQuestionSchema,
  memorySequenceQuestionSchema,
  nbackQuestionSchema,
  speedTaskQuestionSchema,
]);

/** `data/questions.json` dosyasının tamamı: kimlikleri benzersiz sorulardan oluşan dizi. */
export const questionCollectionSchema = z
  .array(questionSchema)
  .refine((questions) => hasUniqueValues(questions.map((q) => q.id)), {
    message: "Soru kimlikleri benzersiz olmalı.",
  });

// ---------------------------------------------------------------------------
// Türetilmiş tipler
// ---------------------------------------------------------------------------

export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type MemoryTransform = (typeof MEMORY_TRANSFORMS)[number];
export type Difficulty = Question["difficulty"];

export type Media = z.infer<typeof mediaSchema>;
export type Option = z.infer<typeof optionSchema>;
export type SpeedTaskItem = z.infer<typeof speedTaskItemSchema>;

export type AnswerFormat = (typeof ANSWER_FORMATS)[number];

export type SingleChoiceQuestion = z.infer<typeof singleChoiceQuestionSchema>;
export type OpenAnswerQuestion = z.infer<typeof openAnswerQuestionSchema>;
export type NbackQuestion = z.infer<typeof nbackQuestionSchema>;
export type MultiChoiceQuestion = z.infer<typeof multiChoiceQuestionSchema>;
export type MemorySequenceQuestion = z.infer<typeof memorySequenceQuestionSchema>;
export type SpeedTaskQuestion = z.infer<typeof speedTaskQuestionSchema>;
export type Question = z.infer<typeof questionSchema>;

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

function hasUniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

/** n-back dizisindeki eşleşme (hedef) sayısı: i. öğe, (i − n). öğeyle aynıysa hedeftir. */
function countNbackTargets(sequence: readonly string[], n: number): number {
  return sequence.filter((item, index) => index >= n && item === sequence[index - n]).length;
}

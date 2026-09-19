/**
 * Kullanıcı cevaplarının ve test gönderiminin şeması.
 *
 * Bu veri tarayıcıdan geldiği için güvenilmezdir; API katmanı gönderimi puanlamadan önce
 * `submissionSchema` ile doğrular. Aynı tipler istemci tarafında cevapları tutmak için de
 * kullanılır (bu modül `fs` içermediği için istemciden içe aktarılabilir).
 *
 * Her cevap, ait olduğu soru tipini "type" alanında taşır; böylece puanlayıcı
 * cevabın soruyla uyumlu olup olmadığını kontrol edebilir.
 *
 * Kullanım: /api/test/submit gelen gövdeyi doğrularken, test ekranı ise kullanıcının cevaplarını
 * biriktirirken bu tipleri kullanır.
 */
import { z } from "zod";
import { questionIdSchema } from "@/lib/questions/schema";

/** Tek bir gönderimde kabul edilen en fazla cevap sayısı (kötüye kullanıma karşı üst sınır). */
const MAX_ANSWERS = 500;

const optionIdSchema = z.string().max(8);

export const answerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("single_choice"),
    optionId: optionIdSchema,
  }),
  z.object({
    type: z.literal("multi_choice"),
    optionIds: z.array(optionIdSchema).max(8),
  }),
  z.object({
    type: z.literal("memory_sequence"),
    /** Kullanıcının yazdığı ham metin; puanlamadan önce normalize edilir. */
    value: z.string().max(64),
  }),
  z.object({
    type: z.literal("speed_task"),
    /** Madde kimliği → seçilen şık kimliği. Cevaplanmayan maddeler hiç yer almaz. */
    responses: z.record(z.string().max(16), optionIdSchema),
  }),
]);

export const submissionSchema = z.object({
  /** Soru kimliği → cevap. Cevaplanmayan sorular hiç yer almaz. */
  answers: z
    .record(questionIdSchema, answerSchema)
    .refine((answers) => Object.keys(answers).length <= MAX_ANSWERS, {
      message: "Çok fazla cevap gönderildi.",
    }),
  /**
   * Soru kimliği → o soruda harcanan süre (saniye).
   * Toplam süre bu değerlerin toplamıdır; ayrıca her sorunun hız çarpanı buradan hesaplanır.
   */
  durations: z
    .record(questionIdSchema, z.number().min(0))
    .refine((durations) => Object.keys(durations).length <= MAX_ANSWERS, {
      message: "Çok fazla süre kaydı gönderildi.",
    }),
});

export type Answer = z.infer<typeof answerSchema>;
export type SingleChoiceAnswer = Extract<Answer, { type: "single_choice" }>;
export type MultiChoiceAnswer = Extract<Answer, { type: "multi_choice" }>;
export type MemorySequenceAnswer = Extract<Answer, { type: "memory_sequence" }>;
export type SpeedTaskAnswer = Extract<Answer, { type: "speed_task" }>;
export type AnswerMap = Record<string, Answer>;
/** Soru kimliği → o soruda harcanan süre (saniye). */
export type DurationMap = Record<string, number>;
export type Submission = z.infer<typeof submissionSchema>;

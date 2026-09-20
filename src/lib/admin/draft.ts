/**
 * Admin formunun veri modeli ("taslak") ve taslak → soru dönüşümü.
 *
 * Form alanları metin kutularından geldiği için taslak, gevşek tiplidir (her alan metin
 * olabilir, boş olabilir). Kaydetmeden önce burada gerçek `Question` nesnesine çevrilir ve
 * Zod şemasıyla doğrulanır. Böylece form bileşeni doğrulama kuralı bilmez; kurallar tek yerde
 * (lib/questions/schema.ts) kalır.
 *
 * Kullanım: QuestionForm bileşeni (taslak üretme/dönüştürme) ve admin API route'ları (doğrulama).
 */
import {
  questionSchema,
  type AnswerFormat,
  type MemoryTransform,
  type Question,
  type QuestionCategory,
  type QuestionType,
} from "@/lib/questions/schema";

/** Formdaki tek bir şık. */
export interface DraftOption {
  id: string;
  text: string;
  image: string;
}

/** Hız görevindeki tek bir madde. */
export interface DraftSpeedItem {
  id: string;
  text: string;
  image: string;
  correctOptionId: string;
}

/** Hız görevi anahtar tablosundaki tek bir satır. */
export interface DraftLegendEntry {
  text: string;
  image: string;
  label: string;
}

/**
 * Formun tuttuğu ham veri. Tüm soru tiplerinin alanlarını birlikte taşır; kaydederken
 * yalnızca seçili tipe ait olanlar kullanılır. Böylece kullanıcı tip değiştirdiğinde
 * girdiği veriler kaybolmaz.
 */
export interface QuestionDraft {
  id: string;
  type: QuestionType;
  category: QuestionCategory;
  difficulty: 1 | 2 | 3;
  prompt: string;
  promptImage: string;
  expectedSec: string;
  explanation: string;
  active: boolean;

  // single_choice / multi_choice / speed_task ortak şıkları
  options: DraftOption[];
  correctOptionId: string;
  correctOptionIds: string[];

  // open_answer
  answerFormat: AnswerFormat;
  /** Kabul edilen cevaplar, satır satır girilir. */
  acceptedAnswers: string;
  placeholder: string;

  // memory_sequence
  sequence: string;
  itemDisplayMs: string;
  transform: MemoryTransform;

  // nback_task
  nbackN: string;
  nbackSequence: string;
  nbackItemDisplayMs: string;

  // speed_task
  timeLimitSec: string;
  legend: DraftLegendEntry[];
  items: DraftSpeedItem[];
}

/** Yeni soru formunun başlangıç değerleri. */
export function createEmptyDraft(): QuestionDraft {
  return {
    id: "",
    type: "single_choice",
    category: "numeric_pattern",
    difficulty: 1,
    prompt: "",
    promptImage: "",
    expectedSec: "",
    explanation: "",
    active: true,
    options: [
      { id: "a", text: "", image: "" },
      { id: "b", text: "", image: "" },
      { id: "c", text: "", image: "" },
      { id: "d", text: "", image: "" },
    ],
    correctOptionId: "a",
    correctOptionIds: [],
    answerFormat: "number",
    acceptedAnswers: "",
    placeholder: "",
    sequence: "",
    itemDisplayMs: "1000",
    transform: "reverse",
    nbackN: "2",
    nbackSequence: "",
    nbackItemDisplayMs: "2000",
    timeLimitSec: "45",
    legend: [],
    items: [],
  };
}

/** Var olan bir soruyu düzenleme formuna yüklemek için taslağa çevirir. */
export function questionToDraft(question: Question): QuestionDraft {
  const draft: QuestionDraft = {
    ...createEmptyDraft(),
    id: question.id,
    type: question.type,
    category: question.category,
    difficulty: question.difficulty,
    prompt: question.prompt,
    promptImage: question.promptImage ?? "",
    expectedSec: question.expectedSec === undefined ? "" : String(question.expectedSec),
    explanation: question.explanation ?? "",
    active: question.active,
  };

  switch (question.type) {
    case "single_choice":
      return {
        ...draft,
        options: question.options.map(toDraftOption),
        correctOptionId: question.correctOptionId,
      };

    case "multi_choice":
      return {
        ...draft,
        options: question.options.map(toDraftOption),
        correctOptionIds: question.correctOptionIds,
      };

    case "open_answer":
      return {
        ...draft,
        answerFormat: question.answerFormat,
        acceptedAnswers: question.acceptedAnswers.join("\n"),
        placeholder: question.placeholder ?? "",
      };

    case "nback_task":
      return {
        ...draft,
        nbackN: String(question.n),
        nbackSequence: question.sequence.join(" "),
        nbackItemDisplayMs: String(question.itemDisplayMs),
      };

    case "memory_sequence":
      return {
        ...draft,
        sequence: question.sequence.join(" "),
        itemDisplayMs: String(question.itemDisplayMs),
        transform: question.transform,
      };

    case "speed_task":
      return {
        ...draft,
        options: question.options.map(toDraftOption),
        timeLimitSec: String(question.timeLimitSec),
        legend: (question.legend ?? []).map((entry) => ({
          text: entry.symbol.text ?? "",
          image: entry.symbol.image ?? "",
          label: entry.label,
        })),
        items: question.items.map((item) => ({
          id: item.id,
          text: item.stimulus.text ?? "",
          image: item.stimulus.image ?? "",
          correctOptionId: item.correctOptionId,
        })),
      };
  }
}

export type DraftConversion =
  | { ok: true; question: Question }
  | { ok: false; errors: string[] };

/**
 * Taslağı `Question` nesnesine çevirir ve şemaya göre doğrular.
 * Hatalar, formda gösterilmek üzere okunabilir metinler olarak döner.
 */
export function draftToQuestion(draft: QuestionDraft): DraftConversion {
  const base = {
    id: draft.id.trim(),
    category: draft.category,
    difficulty: draft.difficulty,
    prompt: draft.prompt.trim(),
    ...optionalText("promptImage", draft.promptImage),
    ...optionalNumber("expectedSec", draft.expectedSec),
    ...optionalText("explanation", draft.explanation),
    active: draft.active,
  };

  const candidate = buildByType(draft, base);
  const result = questionSchema.safeParse(candidate);

  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map((issue) => {
        const path = issue.path.map(String).join(".");
        return path === "" ? issue.message : `${path}: ${issue.message}`;
      }),
    };
  }
  return { ok: true, question: result.data };
}

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

function buildByType(draft: QuestionDraft, base: Record<string, unknown>): unknown {
  switch (draft.type) {
    case "single_choice":
      return {
        ...base,
        type: "single_choice",
        options: draft.options.map(toOption),
        correctOptionId: draft.correctOptionId,
      };

    case "multi_choice":
      return {
        ...base,
        type: "multi_choice",
        options: draft.options.map(toOption),
        correctOptionIds: draft.correctOptionIds,
      };

    case "open_answer":
      return {
        ...base,
        type: "open_answer",
        answerFormat: draft.answerFormat,
        // Her satır ayrı bir kabul edilen cevaptır; boş satırlar atılır.
        acceptedAnswers: draft.acceptedAnswers
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line !== ""),
        ...optionalText("placeholder", draft.placeholder),
      };

    case "nback_task":
      return {
        ...base,
        type: "nback_task",
        n: toNumber(draft.nbackN),
        sequence: splitSequence(draft.nbackSequence),
        itemDisplayMs: toNumber(draft.nbackItemDisplayMs),
      };

    case "memory_sequence":
      return {
        ...base,
        type: "memory_sequence",
        sequence: splitSequence(draft.sequence),
        itemDisplayMs: toNumber(draft.itemDisplayMs),
        transform: draft.transform,
      };

    case "speed_task":
      return {
        ...base,
        type: "speed_task",
        timeLimitSec: toNumber(draft.timeLimitSec),
        ...(draft.legend.length > 0 && {
          legend: draft.legend.map((entry) => ({
            symbol: toMedia(entry),
            label: entry.label.trim(),
          })),
        }),
        options: draft.options.map(toOption),
        items: draft.items.map((item) => ({
          id: item.id.trim(),
          stimulus: toMedia(item),
          correctOptionId: item.correctOptionId,
        })),
      };
  }
}

/**
 * Dizi alanını ayrıştırır: "7 2 9", "7,2,9" veya "7-2-9" biçimleri kabul edilir,
 * harfler büyütülür.
 */
function splitSequence(value: string): string[] {
  return value
    .toUpperCase()
    .split(/[^0-9A-Z]+/)
    .filter((item) => item !== "");
}

function toDraftOption(option: { id: string; text?: string; image?: string }): DraftOption {
  return { id: option.id, text: option.text ?? "", image: option.image ?? "" };
}

function toOption(option: DraftOption): Record<string, unknown> {
  return {
    id: option.id.trim(),
    ...optionalText("text", option.text),
    ...optionalText("image", option.image),
  };
}

function toMedia(media: { text: string; image: string }): Record<string, unknown> {
  return {
    ...optionalText("text", media.text),
    ...optionalText("image", media.image),
  };
}

/** Boş metinleri alana hiç eklemez; şemada bu alanlar "isteğe bağlı" olduğu için. */
function optionalText(key: string, value: string): Record<string, string> {
  const trimmed = value.trim();
  return trimmed === "" ? {} : { [key]: trimmed };
}

function optionalNumber(key: string, value: string): Record<string, number> {
  const trimmed = value.trim();
  return trimmed === "" ? {} : { [key]: toNumber(trimmed) };
}

/** Metni sayıya çevirir; çevrilemezse NaN döner ve şema doğrulaması hatayı yakalar. */
function toNumber(value: string): number {
  return Number(value.trim());
}

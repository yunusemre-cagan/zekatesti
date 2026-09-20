/**
 * Birim testlerinde kullanılan örnek soru üreticileri.
 *
 * Her fonksiyon geçerli bir soru döner; testler yalnızca ilgilendikleri alanı
 * `overrides` ile değiştirir. Uygulama kodu tarafından kullanılmaz.
 *
 * Kullanım: Yalnızca *.test.ts dosyaları tarafından kullanılır.
 */
import type {
  MemorySequenceQuestion,
  MultiChoiceQuestion,
  NbackQuestion,
  OpenAnswerQuestion,
  SingleChoiceQuestion,
  SpeedTaskQuestion,
} from "@/lib/questions/schema";

export function makeSingleChoice(overrides: Partial<SingleChoiceQuestion> = {}): SingleChoiceQuestion {
  return {
    id: "single-1",
    type: "single_choice",
    category: "numeric_pattern",
    difficulty: 1,
    prompt: "2, 4, 6, ?",
    options: [
      { id: "a", text: "7" },
      { id: "b", text: "8" },
    ],
    correctOptionId: "b",
    explanation: "Her adımda 2 eklenir.",
    active: true,
    ...overrides,
  };
}

export function makeMultiChoice(overrides: Partial<MultiChoiceQuestion> = {}): MultiChoiceQuestion {
  return {
    id: "multi-1",
    type: "multi_choice",
    category: "spatial_reasoning",
    difficulty: 3,
    prompt: "Hangileri aynı cisimdir?",
    options: [
      { id: "a", image: "/questions/multi-1/a.svg" },
      { id: "b", image: "/questions/multi-1/b.svg" },
      { id: "c", image: "/questions/multi-1/c.svg" },
    ],
    correctOptionIds: ["a", "c"],
    explanation: "A ve C aynı cismin döndürülmüş halidir.",
    active: true,
    ...overrides,
  };
}

export function makeOpenAnswer(overrides: Partial<OpenAnswerQuestion> = {}): OpenAnswerQuestion {
  return {
    id: "acik-1",
    type: "open_answer",
    category: "numeric_pattern",
    difficulty: 3,
    prompt: "2, 3, 5, 9, ?",
    answerFormat: "number",
    acceptedAnswers: ["17"],
    explanation: "Her terim iki katının bir eksiğidir.",
    active: true,
    ...overrides,
  };
}

/** İki önceki ile eşleşen üç konum içerir (indeksler: 2, 5, 8). */
export function makeNback(overrides: Partial<NbackQuestion> = {}): NbackQuestion {
  return {
    id: "nback-1",
    type: "nback_task",
    category: "working_memory",
    difficulty: 3,
    prompt: "İki önceki harfle aynı olduğunda işaretleyin.",
    n: 2,
    sequence: ["K", "M", "K", "T", "R", "T", "Z", "B", "Z", "N"],
    itemDisplayMs: 2000,
    active: true,
    ...overrides,
  };
}

export function makeMemory(overrides: Partial<MemorySequenceQuestion> = {}): MemorySequenceQuestion {
  return {
    id: "memory-1",
    type: "memory_sequence",
    category: "working_memory",
    difficulty: 2,
    prompt: "Tersten yazın.",
    sequence: ["7", "2", "9", "4", "1", "8"],
    itemDisplayMs: 1000,
    transform: "reverse",
    active: true,
    ...overrides,
  };
}

export function makeSpeedTask(overrides: Partial<SpeedTaskQuestion> = {}): SpeedTaskQuestion {
  return {
    id: "speed-1",
    type: "speed_task",
    category: "processing_speed",
    difficulty: 2,
    prompt: "Eşleştirin.",
    timeLimitSec: 30,
    legend: [
      { symbol: { text: "★" }, label: "1" },
      { symbol: { text: "●" }, label: "2" },
    ],
    options: [
      { id: "1", text: "1" },
      { id: "2", text: "2" },
    ],
    items: [
      { id: "i1", stimulus: { text: "★" }, correctOptionId: "1" },
      { id: "i2", stimulus: { text: "●" }, correctOptionId: "2" },
      { id: "i3", stimulus: { text: "★" }, correctOptionId: "1" },
      { id: "i4", stimulus: { text: "●" }, correctOptionId: "2" },
    ],
    active: true,
    ...overrides,
  };
}

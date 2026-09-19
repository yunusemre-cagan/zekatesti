import { describe, expect, it } from "vitest";
import { IQ_SCALE, TEST_DURATION_SEC } from "@/lib/config";
import type { AnswerMap } from "@/lib/test/answers";
import { makeMemory, makeMultiChoice, makeSingleChoice, makeSpeedTask } from "@/lib/testing/fixtures";
import { scoreTest } from "./score-test";

/** Zorlukları 1 (tek seçim), 3 (çoklu seçim), 2 (bellek), 2 (hız) → toplam ağırlık 8. */
const questions = [makeSingleChoice(), makeMultiChoice(), makeMemory(), makeSpeedTask()];

const allCorrect: AnswerMap = {
  "single-1": { type: "single_choice", optionId: "b" },
  "multi-1": { type: "multi_choice", optionIds: ["a", "c"] },
  "memory-1": { type: "memory_sequence", value: "814927" },
  "speed-1": { type: "speed_task", responses: { i1: "1", i2: "2", i3: "1", i4: "2" } },
};

describe("scoreTest", () => {
  it("tüm cevaplar doğruysa oran 1'dir ve IQ üst sınırı aşmaz", () => {
    const result = scoreTest(questions, allCorrect, 600);
    expect(result.scoreRatio).toBe(1);
    expect(result.correctCount).toBe(4);
    expect(result.totalQuestions).toBe(4);
    expect(result.estimatedIq).toBeLessThanOrEqual(IQ_SCALE.MAX);
  });

  it("hiç cevap yoksa oran 0'dır ve tüm sorular 'unanswered' olur", () => {
    const result = scoreTest(questions, {}, 600);
    expect(result.scoreRatio).toBe(0);
    expect(result.estimatedIq).toBe(IQ_SCALE.MIN);
    expect(result.questions.every((q) => q.status === "unanswered")).toBe(true);
  });

  it("puanları zorlukla ağırlıklandırır", () => {
    // Yalnızca zorluk 3 olan çoklu seçim doğru → 3 / 8
    const result = scoreTest(questions, { "multi-1": allCorrect["multi-1"]! }, 600);
    expect(result.scoreRatio).toBeCloseTo(3 / 8);
  });

  it("kısmi puanı da ağırlıkla çarpar", () => {
    // Hız görevinde 4 maddeden 2'si doğru (0.5) × zorluk 2 = 1 → 1 / 8
    const answers: AnswerMap = { "speed-1": { type: "speed_task", responses: { i1: "1", i2: "2" } } };
    const result = scoreTest(questions, answers, 600);
    expect(result.scoreRatio).toBeCloseTo(1 / 8);
    expect(result.questions.find((q) => q.questionId === "speed-1")?.status).toBe("partial");
    expect(result.correctCount).toBe(0);
  });

  it("testte olmayan sorulara ait cevapları yok sayar", () => {
    const answers: AnswerMap = { ...allCorrect, "baska-soru": { type: "single_choice", optionId: "a" } };
    expect(scoreTest(questions, answers, 600).totalQuestions).toBe(4);
  });

  it("prototip kimliklerine ('__proto__' vb.) karşı güvenlidir", () => {
    const tricky = makeSingleChoice({ id: "constructor" });
    const result = scoreTest([tricky], {}, 0);
    expect(result.questions[0]?.status).toBe("unanswered");
  });

  it("kategori dökümünü yalnızca testte bulunan kategoriler için, tanım sırasıyla üretir", () => {
    const result = scoreTest(questions, allCorrect, 600);
    expect(result.categories.map((c) => c.category)).toEqual([
      "numeric_pattern",
      "spatial_reasoning",
      "working_memory",
      "processing_speed",
    ]);
    expect(result.categories.every((c) => c.ratio === 1)).toBe(true);
  });

  it("aynı kategorideki soruları birlikte toplar", () => {
    const twoNumeric = [makeSingleChoice(), makeSingleChoice({ id: "single-2", difficulty: 3 })];
    const answers: AnswerMap = { "single-2": { type: "single_choice", optionId: "b" } };
    const [category] = scoreTest(twoNumeric, answers, 0).categories;
    expect(category).toMatchObject({ category: "numeric_pattern", questionCount: 2, earned: 3, max: 4 });
  });

  it("soru sonuçlarını test sırasıyla ve açıklamalarıyla döner", () => {
    const result = scoreTest(questions, allCorrect, 600);
    expect(result.questions.map((q) => q.questionId)).toEqual(["single-1", "multi-1", "memory-1", "speed-1"]);
    expect(result.questions[0]?.explanation).toBe("Her adımda 2 eklenir.");
    expect(result.questions[2]).not.toHaveProperty("explanation");
  });

  it("geçen süreyi [0, TEST_DURATION_SEC] aralığına sınırlar ve yuvarlar", () => {
    expect(scoreTest(questions, {}, -10).elapsedSec).toBe(0);
    expect(scoreTest(questions, {}, TEST_DURATION_SEC + 999).elapsedSec).toBe(TEST_DURATION_SEC);
    expect(scoreTest(questions, {}, 12.6).elapsedSec).toBe(13);
  });

  it("boş soru listesinde hata vermez", () => {
    const result = scoreTest([], {}, 0);
    expect(result.scoreRatio).toBe(0);
    expect(result.categories).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { IQ_SCALE, QUESTION_TIME } from "@/lib/config";
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
    const result = scoreTest(questions, allCorrect, {});
    expect(result.scoreRatio).toBe(1);
    expect(result.correctCount).toBe(4);
    expect(result.totalQuestions).toBe(4);
    expect(result.estimatedIq).toBeLessThanOrEqual(IQ_SCALE.MAX);
  });

  it("hiç cevap yoksa oran 0'dır ve tüm sorular 'unanswered' olur", () => {
    const result = scoreTest(questions, {}, {});
    expect(result.scoreRatio).toBe(0);
    expect(result.estimatedIq).toBe(IQ_SCALE.MIN);
    expect(result.questions.every((q) => q.status === "unanswered")).toBe(true);
  });

  it("puanları zorlukla ağırlıklandırır", () => {
    // Yalnızca zorluk 3 olan çoklu seçim doğru → 3 / 8
    const result = scoreTest(questions, { "multi-1": allCorrect["multi-1"]! }, {});
    expect(result.scoreRatio).toBeCloseTo(3 / 8);
  });

  it("kısmi puanı da ağırlıkla çarpar", () => {
    // Hız görevinde 4 maddeden 2'si doğru (0.5) × zorluk 2 = 1 → 1 / 8
    const answers: AnswerMap = { "speed-1": { type: "speed_task", responses: { i1: "1", i2: "2" } } };
    const result = scoreTest(questions, answers, {});
    expect(result.scoreRatio).toBeCloseTo(1 / 8);
    expect(result.questions.find((q) => q.questionId === "speed-1")?.status).toBe("partial");
    expect(result.correctCount).toBe(0);
  });

  it("testte olmayan sorulara ait cevapları yok sayar", () => {
    const answers: AnswerMap = { ...allCorrect, "baska-soru": { type: "single_choice", optionId: "a" } };
    expect(scoreTest(questions, answers, {}).totalQuestions).toBe(4);
  });

  it("prototip kimliklerine ('__proto__' vb.) karşı güvenlidir", () => {
    const tricky = makeSingleChoice({ id: "constructor" });
    const result = scoreTest([tricky], {}, {});
    expect(result.questions[0]?.status).toBe("unanswered");
  });

  it("kategori dökümünü yalnızca testte bulunan kategoriler için, tanım sırasıyla üretir", () => {
    const result = scoreTest(questions, allCorrect, {});
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
    const [category] = scoreTest(twoNumeric, answers, {}).categories;
    expect(category).toMatchObject({ category: "numeric_pattern", questionCount: 2, earned: 3, max: 4 });
  });

  it("soru sonuçlarını test sırasıyla ve açıklamalarıyla döner", () => {
    const result = scoreTest(questions, allCorrect, {});
    expect(result.questions.map((q) => q.questionId)).toEqual(["single-1", "multi-1", "memory-1", "speed-1"]);
    expect(result.questions[0]?.explanation).toBe("Her adımda 2 eklenir.");
    expect(result.questions[2]).not.toHaveProperty("explanation");
  });

  describe("süre ölçümü ve hız çarpanı", () => {
    it("soru sürelerini toplayarak toplam süreyi verir", () => {
      const durations = { "single-1": 30, "multi-1": 45.4, "memory-1": 20 };
      expect(scoreTest(questions, allCorrect, durations).totalSeconds).toBe(95);
    });

    it("soru başına kayıt üst sınırını uygular", () => {
      const durations = { "single-1": 99_999 };
      const result = scoreTest(questions, allCorrect, durations);
      expect(result.questions[0]?.seconds).toBe(QUESTION_TIME.MAX_RECORDED_SEC);
    });

    it("yavaş çözülen doğru cevabın puanını düşürür", () => {
      // single-1: zorluk 1, beklenen 45 sn. 90 saniyede çözülürse çarpan 0.5 olur.
      const slow = scoreTest(questions, allCorrect, { "single-1": 90 });
      const fast = scoreTest(questions, allCorrect, { "single-1": 10 });

      expect(slow.scoreRatio).toBeLessThan(fast.scoreRatio);
      expect(slow.questions[0]?.speedFactor).toBeCloseTo(0.5);
      // Doğruluk oranı hızdan etkilenmez; yalnızca puan oranı düşer.
      expect(slow.accuracyRatio).toBe(1);
      expect(slow.scoreRatio).toBeCloseTo(1 - 0.5 / 8);
    });

    it("yavaş çözülen soruları sayar; boş bırakılanları yavaş saymaz", () => {
      const slow = scoreTest(questions, allCorrect, { "single-1": 300, "multi-1": 300 });
      expect(slow.slowQuestionCount).toBe(2);

      const unanswered = scoreTest(questions, {}, { "single-1": 300 });
      expect(unanswered.slowQuestionCount).toBe(0);
    });

    it("hız görevinin puanını süreye göre düşürmez", () => {
      const result = scoreTest(questions, allCorrect, { "speed-1": 300 });
      expect(result.questions.find((q) => q.questionId === "speed-1")?.speedFactor).toBe(1);
    });

    it("her soru için beklenen süreyi de döner", () => {
      const result = scoreTest(questions, allCorrect, {});
      expect(result.questions[0]?.expectedSec).toBe(45); // zorluk 1
      expect(result.questions[1]?.expectedSec).toBe(120); // zorluk 3
    });

    it("kategori bazında harcanan süreyi toplar", () => {
      const twoNumeric = [makeSingleChoice(), makeSingleChoice({ id: "single-2" })];
      const result = scoreTest(twoNumeric, {}, { "single-1": 10, "single-2": 25 });
      expect(result.categories[0]?.seconds).toBe(35);
    });
  });

  it("boş soru listesinde hata vermez", () => {
    const result = scoreTest([], {}, {});
    expect(result.scoreRatio).toBe(0);
    expect(result.categories).toEqual([]);
  });
});

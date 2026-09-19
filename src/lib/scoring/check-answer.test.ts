import { describe, expect, it } from "vitest";
import { makeMemory, makeMultiChoice, makeSingleChoice, makeSpeedTask } from "@/lib/testing/fixtures";
import { evaluateAnswer, getExpectedMemoryAnswer, normalizeMemoryInput } from "./check-answer";

describe("evaluateAnswer", () => {
  it("cevap yoksa 'unanswered' döner", () => {
    expect(evaluateAnswer(makeSingleChoice(), undefined)).toEqual({ score: 0, status: "unanswered" });
  });

  it("cevap tipi soru tipiyle uyuşmuyorsa 'unanswered' döner", () => {
    const result = evaluateAnswer(makeSingleChoice(), { type: "memory_sequence", value: "8" });
    expect(result).toEqual({ score: 0, status: "unanswered" });
  });

  describe("single_choice", () => {
    it("doğru şıkka tam puan verir", () => {
      expect(evaluateAnswer(makeSingleChoice(), { type: "single_choice", optionId: "b" })).toEqual({
        score: 1,
        status: "correct",
      });
    });

    it("yanlış şıkka 0 puan verir", () => {
      expect(evaluateAnswer(makeSingleChoice(), { type: "single_choice", optionId: "a" })).toEqual({
        score: 0,
        status: "wrong",
      });
    });
  });

  describe("multi_choice", () => {
    // 3 şık (a, b, c); doğru olanlar a ve c → her yanlış işaret 2/1 = 2 puan götürür.
    const question = makeMultiChoice();

    it("doğru kümeye (sıra fark etmeksizin) tam puan verir", () => {
      const result = evaluateAnswer(question, { type: "multi_choice", optionIds: ["c", "a"] });
      expect(result).toEqual({ score: 1, status: "correct" });
    });

    it("iki doğrudan birini bulmaya kısmi puan verir", () => {
      const result = evaluateAnswer(question, { type: "multi_choice", optionIds: ["a"] });
      expect(result).toEqual({ score: 0.5, status: "partial" });
    });

    it("tüm şıkları işaretlemeye puan vermez (garantici seçim engellenir)", () => {
      const result = evaluateAnswer(question, { type: "multi_choice", optionIds: ["a", "b", "c"] });
      expect(result).toEqual({ score: 0, status: "wrong" });
    });

    it("yanlış işaret, doğru işaretin puanını götürür", () => {
      const result = evaluateAnswer(question, { type: "multi_choice", optionIds: ["a", "b"] });
      expect(result).toEqual({ score: 0, status: "wrong" });
    });

    it("yalnızca yanlış şık işaretlendiğinde puanı negatife düşürmez", () => {
      const result = evaluateAnswer(question, { type: "multi_choice", optionIds: ["b"] });
      expect(result).toEqual({ score: 0, status: "wrong" });
    });

    it("tekrar eden seçimleri tek sayar", () => {
      const result = evaluateAnswer(question, { type: "multi_choice", optionIds: ["a", "a", "c"] });
      expect(result.status).toBe("correct");
    });

    it("soruda bulunmayan şık kimliklerini yok sayar", () => {
      const result = evaluateAnswer(question, { type: "multi_choice", optionIds: ["a", "c", "z"] });
      expect(result.status).toBe("correct");
    });
  });

  describe("memory_sequence", () => {
    it.each(["814927", "8 1 4 9 2 7", "8-1-4-9-2-7", "8,1,4,9,2,7"])(
      "ayraçlı veya ayraçsız doğru cevabı kabul eder: %s",
      (value) => {
        expect(evaluateAnswer(makeMemory(), { type: "memory_sequence", value }).status).toBe("correct");
      },
    );

    it("düz sırada yazılmış cevabı 'reverse' sorusunda reddeder", () => {
      const result = evaluateAnswer(makeMemory(), { type: "memory_sequence", value: "729418" });
      expect(result.status).toBe("wrong");
    });

    it("boş cevabı yanlış sayar", () => {
      const result = evaluateAnswer(makeMemory(), { type: "memory_sequence", value: "" });
      expect(result.status).toBe("wrong");
    });
  });

  describe("speed_task", () => {
    // 4 madde, 2 şık → her yanlış madde 1/(2−1) = 1 madde değerinde puan götürür.
    const question = makeSpeedTask();

    it("tüm maddeler doğruysa tam puan verir", () => {
      const responses = { i1: "1", i2: "2", i3: "1", i4: "2" };
      expect(evaluateAnswer(question, { type: "speed_task", responses })).toEqual({
        score: 1,
        status: "correct",
      });
    });

    it("yanlış maddeler puan düşürür; boş bırakılan madde etkisizdir", () => {
      const responses = { i1: "1", i2: "1", i3: "1" }; // i1, i3 doğru; i2 yanlış; i4 boş
      expect(evaluateAnswer(question, { type: "speed_task", responses })).toEqual({
        score: 0.25, // (2 doğru − 1 yanlış) / 4 madde
        status: "partial",
      });
    });

    it("doğru sayısı kadar yanlış yapıldığında puan sıfırlanır", () => {
      const responses = { i1: "1", i2: "1" }; // 1 doğru, 1 yanlış
      expect(evaluateAnswer(question, { type: "speed_task", responses }).score).toBe(0);
    });

    it("yanlış sayısı doğruyu aşsa bile puanı negatife düşürmez", () => {
      const responses = { i1: "2", i2: "1", i3: "2", i4: "1" }; // hepsi yanlış
      expect(evaluateAnswer(question, { type: "speed_task", responses })).toEqual({
        score: 0,
        status: "wrong",
      });
    });

    it("hiç cevap verilmemişse 0 puan verir", () => {
      const result = evaluateAnswer(question, { type: "speed_task", responses: {} });
      expect(result).toEqual({ score: 0, status: "wrong" });
    });

    it("görevde olmayan madde kimliklerini yok sayar", () => {
      const responses = { i1: "1", yok: "2" };
      expect(evaluateAnswer(question, { type: "speed_task", responses }).score).toBe(0.25);
    });

    it("şıklarda bulunmayan cevap kimliğini yok sayar (yanlış saymaz)", () => {
      const responses = { i1: "1", i2: "9" };
      expect(evaluateAnswer(question, { type: "speed_task", responses }).score).toBe(0.25);
    });
  });
});

describe("getExpectedMemoryAnswer", () => {
  const sequence = ["7", "2", "9", "4"];

  it.each([
    ["same", "7294"],
    ["reverse", "4927"],
    ["sorted", "2479"],
  ] as const)("%s dönüşümü → %s", (transform, expected) => {
    expect(getExpectedMemoryAnswer(makeMemory({ sequence, transform }))).toBe(expected);
  });

  it("harf dizilerini alfabetik sıralar", () => {
    const question = makeMemory({ sequence: ["K", "C", "T", "A"], transform: "sorted" });
    expect(getExpectedMemoryAnswer(question)).toBe("ACKT");
  });

  it("orijinal diziyi değiştirmez", () => {
    const question = makeMemory({ sequence: [...sequence], transform: "reverse" });
    getExpectedMemoryAnswer(question);
    expect(question.sequence).toEqual(sequence);
  });
});

describe("normalizeMemoryInput", () => {
  it("rakam ve harf dışındaki karakterleri siler, harfleri büyütür", () => {
    expect(normalizeMemoryInput(" k - c , t ")).toBe("KCT");
  });

  it("küçük 'i' harfini (Türkçe 'İ' değil) 'I' yapar", () => {
    expect(normalizeMemoryInput("i")).toBe("I");
  });
});

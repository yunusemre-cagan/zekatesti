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
    const question = makeMultiChoice();

    it("doğru kümeye (sıra fark etmeksizin) tam puan verir", () => {
      const result = evaluateAnswer(question, { type: "multi_choice", optionIds: ["c", "a"] });
      expect(result.status).toBe("correct");
    });

    it("eksik seçime kısmi puan vermez", () => {
      const result = evaluateAnswer(question, { type: "multi_choice", optionIds: ["a"] });
      expect(result).toEqual({ score: 0, status: "wrong" });
    });

    it("tüm şıkları işaretlemeye puan vermez", () => {
      const result = evaluateAnswer(question, { type: "multi_choice", optionIds: ["a", "b", "c"] });
      expect(result.status).toBe("wrong");
    });

    it("tekrar eden seçimleri tek sayar", () => {
      const result = evaluateAnswer(question, { type: "multi_choice", optionIds: ["a", "a", "c"] });
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
    const question = makeSpeedTask();

    it("tüm maddeler doğruysa tam puan verir", () => {
      const responses = { i1: "1", i2: "2", i3: "1", i4: "2" };
      expect(evaluateAnswer(question, { type: "speed_task", responses })).toEqual({
        score: 1,
        status: "correct",
      });
    });

    it("doğru madde oranında kısmi puan verir; cevaplanmayan madde 0 sayılır", () => {
      const responses = { i1: "1", i2: "1", i3: "1" }; // i2 yanlış, i4 boş
      expect(evaluateAnswer(question, { type: "speed_task", responses })).toEqual({
        score: 0.5,
        status: "partial",
      });
    });

    it("hiç doğru yoksa 0 puan verir", () => {
      const result = evaluateAnswer(question, { type: "speed_task", responses: {} });
      expect(result).toEqual({ score: 0, status: "wrong" });
    });

    it("görevde olmayan madde kimliklerini yok sayar", () => {
      const responses = { i1: "1", yok: "1" };
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

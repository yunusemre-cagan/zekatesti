import { describe, expect, it } from "vitest";
import {
  makeMemory,
  makeMultiChoice,
  makeNback,
  makeOpenAnswer,
  makeSingleChoice,
  makeSpeedTask,
} from "@/lib/testing/fixtures";
import {
  evaluateAnswer,
  getExpectedMemoryAnswer,
  getNbackTargets,
  normalizeMemoryInput,
  normalizeOpenAnswer,
} from "./check-answer";

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

  describe("open_answer", () => {
    const question = makeOpenAnswer(); // kabul edilen cevap: "17"

    it("doğru cevaba tam puan verir", () => {
      expect(evaluateAnswer(question, { type: "open_answer", value: "17" })).toEqual({
        score: 1,
        status: "correct",
      });
    });

    it("sayısal cevapta boşluk ve biçim farklarını göz ardı eder", () => {
      for (const value of [" 17 ", "17,0", "17.0", "+17"]) {
        expect(evaluateAnswer(question, { type: "open_answer", value }).status).toBe("correct");
      }
    });

    it("binlik ayracını yok sayar", () => {
      const big = makeOpenAnswer({ acceptedAnswers: ["1000"] });
      expect(evaluateAnswer(big, { type: "open_answer", value: "1.000" }).status).toBe("correct");
    });

    it("yanlış cevaba puan vermez", () => {
      expect(evaluateAnswer(question, { type: "open_answer", value: "18" })).toEqual({
        score: 0,
        status: "wrong",
      });
    });

    it("boş cevabı yanlış sayar", () => {
      expect(evaluateAnswer(question, { type: "open_answer", value: "   " }).score).toBe(0);
    });

    it("metin biçiminde büyük-küçük harf farkını göz ardı eder", () => {
      const text = makeOpenAnswer({ answerFormat: "text", acceptedAnswers: ["TUMRA"] });
      expect(evaluateAnswer(text, { type: "open_answer", value: "tumra" }).status).toBe("correct");
    });

    it("birden fazla kabul edilen cevabı destekler", () => {
      const multi = makeOpenAnswer({ answerFormat: "text", acceptedAnswers: ["OTUZ ÜÇ", "33"] });
      expect(evaluateAnswer(multi, { type: "open_answer", value: "otuz üç" }).status).toBe("correct");
      expect(evaluateAnswer(multi, { type: "open_answer", value: "33" }).status).toBe("correct");
    });
  });

  describe("nback_task", () => {
    // Fixture dizisinde eşleşme konumları: 2, 5, 8
    const question = makeNback();

    it("tüm eşleşmeler doğru işaretlenirse tam puan verir", () => {
      const result = evaluateAnswer(question, { type: "nback_task", markedIndices: [2, 5, 8] });
      expect(result).toEqual({ score: 1, status: "correct" });
    });

    it("eksik işaretlemede kısmi puan verir", () => {
      const result = evaluateAnswer(question, { type: "nback_task", markedIndices: [2, 5] });
      expect(result).toEqual({ score: 2 / 3, status: "partial" });
    });

    it("yanlış işaret, doğru işaretin puanını götürür", () => {
      const result = evaluateAnswer(question, { type: "nback_task", markedIndices: [2, 5, 3] });
      expect(result.score).toBeCloseTo(1 / 3);
    });

    it("her adımda işaretleyen kullanıcıya puan vermez", () => {
      const hepsi = question.sequence.map((_, index) => index);
      const result = evaluateAnswer(question, { type: "nback_task", markedIndices: hepsi });
      expect(result).toEqual({ score: 0, status: "wrong" });
    });

    it("hiç işaretlemeyene puan vermez ama ceza da uygulamaz", () => {
      const result = evaluateAnswer(question, { type: "nback_task", markedIndices: [] });
      expect(result).toEqual({ score: 0, status: "wrong" });
    });

    it("dizi dışındaki ve tekrar eden işaretleri yok sayar", () => {
      const result = evaluateAnswer(question, {
        type: "nback_task",
        markedIndices: [2, 2, 5, 8, 999],
      });
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

describe("getNbackTargets", () => {
  it("n adım öncesiyle eşleşen konumları bulur", () => {
    expect(getNbackTargets(makeNback())).toEqual([2, 5, 8]);
  });

  it("n değiştiğinde farklı konumlar çıkar", () => {
    const question = makeNback({ n: 1, sequence: ["A", "A", "B", "C", "C", "C"] });
    expect(getNbackTargets(question)).toEqual([1, 4, 5]);
  });
});

describe("normalizeOpenAnswer", () => {
  it("sayıları sayısal değere indirger", () => {
    expect(normalizeOpenAnswer("1.000", "number")).toBe("1000");
    expect(normalizeOpenAnswer("3,5", "number")).toBe("3.5");
    expect(normalizeOpenAnswer(" 42 ", "number")).toBe("42");
  });

  it("metinlerde boşlukları sadeleştirir ve Türkçe kurallarıyla büyütür", () => {
    expect(normalizeOpenAnswer("  istanbul  ", "text")).toBe("İSTANBUL");
    expect(normalizeOpenAnswer("otuz   üç", "text")).toBe("OTUZ ÜÇ");
  });

  it("sayıya çevrilemeyen girdiyi olduğu gibi bırakır", () => {
    expect(normalizeOpenAnswer("kırk iki", "number")).toBe("kırkiki");
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

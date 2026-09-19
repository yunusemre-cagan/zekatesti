/**
 * Soru şemasının kurallarını doğrulayan testler.
 * Her testte geçerli bir örnekten başlanıp tek bir alan bozulur; böylece hangi kuralın
 * test edildiği açıkça görülür.
 */
import { describe, expect, it } from "vitest";
import { questionCollectionSchema, questionSchema } from "./schema";

const validSingleChoice = {
  id: "numeric-pattern-99",
  type: "single_choice",
  category: "numeric_pattern",
  difficulty: 1,
  prompt: "1, 2, 3, ?",
  options: [
    { id: "a", text: "4" },
    { id: "b", text: "5" },
  ],
  correctOptionId: "a",
  active: true,
};

const validMultiChoice = {
  id: "spatial-99",
  type: "multi_choice",
  category: "spatial_reasoning",
  difficulty: 3,
  prompt: "Hangileri aynı cisimdir?",
  options: [
    { id: "a", image: "/questions/spatial-99/a.svg" },
    { id: "b", image: "/questions/spatial-99/b.svg" },
    { id: "c", image: "/questions/spatial-99/c.svg" },
  ],
  correctOptionIds: ["a", "c"],
  active: true,
};

const validMemory = {
  id: "memory-99",
  type: "memory_sequence",
  category: "working_memory",
  difficulty: 2,
  prompt: "Tersten yazın.",
  sequence: ["1", "2", "3"],
  itemDisplayMs: 1000,
  transform: "reverse",
  active: true,
};

const validSpeedTask = {
  id: "speed-99",
  type: "speed_task",
  category: "processing_speed",
  difficulty: 2,
  prompt: "Eşleştirin.",
  timeLimitSec: 30,
  options: [
    { id: "1", text: "1" },
    { id: "2", text: "2" },
  ],
  items: [
    { id: "i1", stimulus: { text: "★" }, correctOptionId: "1" },
    { id: "i2", stimulus: { text: "●" }, correctOptionId: "2" },
    { id: "i3", stimulus: { text: "★" }, correctOptionId: "1" },
  ],
  active: true,
};

describe("questionSchema", () => {
  it.each([
    ["single_choice", validSingleChoice],
    ["multi_choice", validMultiChoice],
    ["memory_sequence", validMemory],
    ["speed_task", validSpeedTask],
  ])("geçerli %s sorusunu kabul eder", (_type, question) => {
    expect(questionSchema.safeParse(question).success).toBe(true);
  });

  it("bilinmeyen soru tipini reddeder", () => {
    expect(questionSchema.safeParse({ ...validSingleChoice, type: "essay" }).success).toBe(false);
  });

  it("geçersiz kimlik biçimini reddeder", () => {
    for (const id of ["Buyuk-Harf", "bosluk var", "-tire-ile-baslar", "sayısal"]) {
      expect(questionSchema.safeParse({ ...validSingleChoice, id }).success).toBe(false);
    }
  });

  it("1-3 aralığı dışındaki zorluğu reddeder", () => {
    expect(questionSchema.safeParse({ ...validSingleChoice, difficulty: 4 }).success).toBe(false);
  });

  it("/questions/ dışındaki veya desteklenmeyen uzantılı görsel yollarını reddeder", () => {
    for (const promptImage of ["/etc/passwd.png", "/questions/../secret.svg", "/questions/x/a.exe"]) {
      expect(questionSchema.safeParse({ ...validSingleChoice, promptImage }).success).toBe(false);
    }
  });

  describe("single_choice", () => {
    it("şıklarda bulunmayan doğru cevabı reddeder", () => {
      const result = questionSchema.safeParse({ ...validSingleChoice, correctOptionId: "z" });
      expect(result.success).toBe(false);
    });

    it("metni ve görseli boş olan şıkkı reddeder", () => {
      const options = [{ id: "a" }, { id: "b", text: "5" }];
      expect(questionSchema.safeParse({ ...validSingleChoice, options }).success).toBe(false);
    });

    it("tekrar eden şık kimliklerini reddeder", () => {
      const options = [
        { id: "a", text: "4" },
        { id: "a", text: "5" },
      ];
      expect(questionSchema.safeParse({ ...validSingleChoice, options }).success).toBe(false);
    });

    it("tek şıklı soruyu reddeder", () => {
      const options = [{ id: "a", text: "4" }];
      expect(questionSchema.safeParse({ ...validSingleChoice, options }).success).toBe(false);
    });
  });

  describe("multi_choice", () => {
    it("şıklarda bulunmayan doğru cevabı reddeder", () => {
      const result = questionSchema.safeParse({ ...validMultiChoice, correctOptionIds: ["a", "z"] });
      expect(result.success).toBe(false);
    });

    it("boş doğru cevap listesini reddeder", () => {
      const result = questionSchema.safeParse({ ...validMultiChoice, correctOptionIds: [] });
      expect(result.success).toBe(false);
    });

    it("tekrar eden doğru cevapları reddeder", () => {
      const result = questionSchema.safeParse({ ...validMultiChoice, correctOptionIds: ["a", "a"] });
      expect(result.success).toBe(false);
    });
  });

  describe("memory_sequence", () => {
    it("tek karakter olmayan dizi öğelerini reddeder", () => {
      const result = questionSchema.safeParse({ ...validMemory, sequence: ["12", "3", "4"] });
      expect(result.success).toBe(false);
    });

    it("3'ten kısa diziyi reddeder", () => {
      const result = questionSchema.safeParse({ ...validMemory, sequence: ["1", "2"] });
      expect(result.success).toBe(false);
    });
  });

  describe("speed_task", () => {
    it("ortak şıklarda bulunmayan madde cevabını reddeder", () => {
      const items = [...validSpeedTask.items.slice(1), { id: "i9", stimulus: { text: "■" }, correctOptionId: "9" }];
      expect(questionSchema.safeParse({ ...validSpeedTask, items }).success).toBe(false);
    });

    it("tekrar eden madde kimliklerini reddeder", () => {
      const items = validSpeedTask.items.map((item) => ({ ...item, id: "i1" }));
      expect(questionSchema.safeParse({ ...validSpeedTask, items }).success).toBe(false);
    });
  });
});

describe("questionCollectionSchema", () => {
  it("benzersiz kimlikli koleksiyonu kabul eder", () => {
    const result = questionCollectionSchema.safeParse([validSingleChoice, validMemory]);
    expect(result.success).toBe(true);
  });

  it("aynı kimliği taşıyan iki soruyu reddeder", () => {
    const result = questionCollectionSchema.safeParse([validSingleChoice, { ...validMemory, id: validSingleChoice.id }]);
    expect(result.success).toBe(false);
  });
});

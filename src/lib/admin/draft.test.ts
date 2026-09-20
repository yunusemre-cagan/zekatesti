import { describe, expect, it } from "vitest";
import { makeMemory, makeSingleChoice, makeSpeedTask } from "@/lib/testing/fixtures";
import { createEmptyDraft, draftToQuestion, questionToDraft } from "./draft";

describe("draftToQuestion", () => {
  /** Geçerli, en yalın tek seçimli soru taslağı. */
  function validDraft() {
    return {
      ...createEmptyDraft(),
      id: "ornek-01",
      prompt: "1, 2, 3, ?",
      options: [
        { id: "a", text: "4", image: "" },
        { id: "b", text: "5", image: "" },
      ],
      correctOptionId: "a",
    };
  }

  it("geçerli taslağı soruya çevirir", () => {
    const result = draftToQuestion(validDraft());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.question).toMatchObject({ id: "ornek-01", type: "single_choice" });
    }
  });

  it("boş metin alanlarını hiç eklemez (isteğe bağlı alanlar)", () => {
    const result = draftToQuestion(validDraft());
    if (!result.ok) throw new Error("dönüşüm başarısız");
    expect(result.question).not.toHaveProperty("promptImage");
    expect(result.question).not.toHaveProperty("explanation");
    expect(result.question).not.toHaveProperty("expectedSec");
  });

  it("boşlukları kırpar", () => {
    const result = draftToQuestion({ ...validDraft(), id: "  ornek-01  ", prompt: "  soru  " });
    if (!result.ok) throw new Error("dönüşüm başarısız");
    expect(result.question.id).toBe("ornek-01");
    expect(result.question.prompt).toBe("soru");
  });

  it("geçersiz taslakta okunabilir hata mesajları döner", () => {
    const result = draftToQuestion({ ...validDraft(), id: "GEÇERSİZ KİMLİK" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toContain("Kimlik");
    }
  });

  it("doğru şık seçilmemişse reddeder", () => {
    const result = draftToQuestion({ ...validDraft(), correctOptionId: "z" });
    expect(result.ok).toBe(false);
  });

  describe("bellek sorusu", () => {
    it("diziyi boşluk, virgül veya tireyle ayrılmış girdiden okur", () => {
      for (const sequence of ["7 2 9 4", "7,2,9,4", "7-2-9-4"]) {
        const result = draftToQuestion({
          ...createEmptyDraft(),
          id: "bellek-01",
          type: "memory_sequence",
          category: "working_memory",
          prompt: "Tersten yazın.",
          sequence,
        });
        if (!result.ok) throw new Error(result.errors.join(", "));
        expect(result.question).toMatchObject({ sequence: ["7", "2", "9", "4"] });
      }
    });

    it("küçük harfleri büyütür", () => {
      const result = draftToQuestion({
        ...createEmptyDraft(),
        id: "bellek-02",
        type: "memory_sequence",
        category: "working_memory",
        prompt: "Sıralayın.",
        sequence: "k c t a",
        transform: "sorted",
      });
      if (!result.ok) throw new Error(result.errors.join(", "));
      expect(result.question).toMatchObject({ sequence: ["K", "C", "T", "A"] });
    });
  });

  describe("hız görevi", () => {
    it("anahtar tablo ve maddeleri dönüştürür", () => {
      const result = draftToQuestion({
        ...createEmptyDraft(),
        id: "hiz-01",
        type: "speed_task",
        category: "processing_speed",
        prompt: "Eşleştirin.",
        options: [
          { id: "1", text: "1", image: "" },
          { id: "2", text: "2", image: "" },
        ],
        legend: [{ text: "★", image: "", label: "1" }],
        items: [
          { id: "i1", text: "★", image: "", correctOptionId: "1" },
          { id: "i2", text: "●", image: "", correctOptionId: "2" },
          { id: "i3", text: "★", image: "", correctOptionId: "1" },
        ],
      });

      if (!result.ok) throw new Error(result.errors.join(", "));
      if (result.question.type !== "speed_task") throw new Error("beklenen tip speed_task");

      expect(result.question.legend).toEqual([{ symbol: { text: "★" }, label: "1" }]);
      expect(result.question.items).toHaveLength(3);
      expect(result.question.items[0]).toEqual({
        id: "i1",
        stimulus: { text: "★" },
        correctOptionId: "1",
      });
    });

    it("anahtar tablo boşsa alanı hiç eklemez", () => {
      const result = draftToQuestion({
        ...createEmptyDraft(),
        id: "hiz-02",
        type: "speed_task",
        category: "processing_speed",
        prompt: "Eşleştirin.",
        options: [
          { id: "1", text: "1", image: "" },
          { id: "2", text: "2", image: "" },
        ],
        items: [
          { id: "i1", text: "★", image: "", correctOptionId: "1" },
          { id: "i2", text: "●", image: "", correctOptionId: "2" },
          { id: "i3", text: "★", image: "", correctOptionId: "1" },
        ],
      });
      if (!result.ok) throw new Error(result.errors.join(", "));
      expect(result.question).not.toHaveProperty("legend");
    });
  });
});

describe("questionToDraft ↔ draftToQuestion", () => {
  it.each([
    ["tek seçim", makeSingleChoice()],
    ["bellek", makeMemory()],
    ["hız görevi", makeSpeedTask()],
  ])("%s sorusu taslağa çevrilip geri döndüğünde aynı kalır", (_name, question) => {
    const result = draftToQuestion(questionToDraft(question));
    if (!result.ok) throw new Error(result.errors.join(", "));
    expect(result.question).toEqual(question);
  });
});

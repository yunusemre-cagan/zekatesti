/**
 * Cevap temizleme testleri. En kritik güvence: istemciye giden hiçbir soruda doğru cevap
 * veya açıklama bulunmamalı. Bu, JSON çıktısı üzerinden (tarayıcının göreceği haliyle) kontrol edilir.
 */
import { describe, expect, it } from "vitest";
import { makeMemory, makeMultiChoice, makeSingleChoice, makeSpeedTask } from "@/lib/testing/fixtures";
import { toPublicQuestion } from "./sanitize";

const FORBIDDEN_KEYS = ["correctOptionId", "correctOptionIds", "explanation", "active", "difficulty"];

describe("toPublicQuestion", () => {
  it.each([
    ["single_choice", makeSingleChoice()],
    ["multi_choice", makeMultiChoice()],
    ["memory_sequence", makeMemory({ explanation: "gizli" })],
    ["speed_task", makeSpeedTask({ explanation: "gizli" })],
  ])("%s sorusunda cevap ve açıklama sızdırmaz", (_type, question) => {
    const json = JSON.stringify(toPublicQuestion(question));
    for (const key of FORBIDDEN_KEYS) {
      expect(json).not.toContain(`"${key}"`);
    }
  });

  it("gösterim için gereken alanları korur", () => {
    const question = makeSingleChoice({ promptImage: "/questions/single-1/prompt.svg" });
    expect(toPublicQuestion(question)).toEqual({
      id: question.id,
      type: "single_choice",
      category: question.category,
      prompt: question.prompt,
      promptImage: question.promptImage,
      options: question.options,
    });
  });

  it("görseli olmayan soruda promptImage alanı eklemez", () => {
    expect(toPublicQuestion(makeSingleChoice())).not.toHaveProperty("promptImage");
  });

  it("hız görevinde maddelerin yalnızca kimlik ve uyaranını gönderir", () => {
    const result = toPublicQuestion(makeSpeedTask());
    expect(result.type === "speed_task" && result.items[0]).toEqual({ id: "i1", stimulus: { text: "★" } });
  });

  it("şemada bilinmeyen ek bir alan olsa bile onu göndermez (beyaz liste)", () => {
    const withSecret = { ...makeSingleChoice(), internalNote: "gizli" };
    expect(toPublicQuestion(withSecret)).not.toHaveProperty("internalNote");
  });
});

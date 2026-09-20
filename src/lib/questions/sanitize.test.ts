/**
 * Cevap temizleme testleri. En kritik güvence: istemciye giden hiçbir soruda doğru cevap
 * veya açıklama bulunmamalı. Bu, JSON çıktısı üzerinden (tarayıcının göreceği haliyle) kontrol edilir.
 */
import { describe, expect, it } from "vitest";
import {
  makeMemory,
  makeMultiChoice,
  makeNback,
  makeOpenAnswer,
  makeSingleChoice,
  makeSpeedTask,
} from "@/lib/testing/fixtures";
import { toPublicQuestion } from "./sanitize";

const FORBIDDEN_KEYS = [
  "correctOptionId",
  "correctOptionIds",
  "acceptedAnswers",
  "explanation",
  "active",
  "difficulty",
];

describe("toPublicQuestion", () => {
  it.each([
    ["single_choice", makeSingleChoice()],
    ["multi_choice", makeMultiChoice()],
    ["open_answer", makeOpenAnswer({ explanation: "gizli" })],
    ["memory_sequence", makeMemory({ explanation: "gizli" })],
    ["nback_task", makeNback({ explanation: "gizli" })],
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

  it("açık uçlu soruda kabul edilen cevapları göndermez, biçim bilgisini gönderir", () => {
    const result = toPublicQuestion(makeOpenAnswer({ acceptedAnswers: ["17", "on yedi"] }));
    expect(JSON.stringify(result)).not.toContain("on yedi");
    expect(result.type === "open_answer" && result.answerFormat).toBe("number");
  });

  it("n-back sorusunda diziyi gönderir ama eşleşme konumlarını göndermez", () => {
    const result = toPublicQuestion(makeNback());
    expect(result.type === "nback_task" && result.sequence).toHaveLength(10);
    expect(JSON.stringify(result)).not.toContain("targets");
  });

  it("şemada bilinmeyen ek bir alan olsa bile onu göndermez (beyaz liste)", () => {
    const withSecret = { ...makeSingleChoice(), internalNote: "gizli" };
    expect(toPublicQuestion(withSecret)).not.toHaveProperty("internalNote");
  });
});

import { describe, expect, it } from "vitest";
import { makeSingleChoice } from "@/lib/testing/fixtures";
import { getTestQuestions } from "./ordering";

describe("getTestQuestions", () => {
  const questions = [
    makeSingleChoice({ id: "hard", difficulty: 3 }),
    makeSingleChoice({ id: "easy-1", difficulty: 1 }),
    makeSingleChoice({ id: "inactive", difficulty: 1, active: false }),
    makeSingleChoice({ id: "medium", difficulty: 2 }),
    makeSingleChoice({ id: "easy-2", difficulty: 1 }),
  ];

  it("pasif soruları çıkarır ve kolaydan zora sıralar", () => {
    expect(getTestQuestions(questions).map((q) => q.id)).toEqual(["easy-1", "easy-2", "medium", "hard"]);
  });

  it("aynı zorluktaki soruların dosyadaki sırasını korur", () => {
    const reversedEasy = [makeSingleChoice({ id: "b" }), makeSingleChoice({ id: "a" })];
    expect(getTestQuestions(reversedEasy).map((q) => q.id)).toEqual(["b", "a"]);
  });

  it("girdi dizisini değiştirmez", () => {
    const before = questions.map((q) => q.id);
    getTestQuestions(questions);
    expect(questions.map((q) => q.id)).toEqual(before);
  });
});

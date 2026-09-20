import { describe, expect, it } from "vitest";
import { makeSingleChoice } from "@/lib/testing/fixtures";
import { findAdjacentSameCategory, getTestQuestions } from "./ordering";

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

describe("kategori dağılımı", () => {
  it("aynı kategoriden iki soruyu yan yana koymaz", () => {
    const input = [
      makeSingleChoice({ id: "a1", category: "numeric_pattern", difficulty: 1 }),
      makeSingleChoice({ id: "a2", category: "numeric_pattern", difficulty: 1 }),
      makeSingleChoice({ id: "a3", category: "numeric_pattern", difficulty: 1 }),
      makeSingleChoice({ id: "b1", category: "verbal_analogy", difficulty: 1 }),
      makeSingleChoice({ id: "b2", category: "verbal_analogy", difficulty: 1 }),
      makeSingleChoice({ id: "c1", category: "odd_one_out", difficulty: 1 }),
    ];

    expect(findAdjacentSameCategory(getTestQuestions(input))).toEqual([]);
  });

  it("kategori çakışması yoksa zorluk sırasını bozmaz", () => {
    const input = [
      makeSingleChoice({ id: "kolay", category: "numeric_pattern", difficulty: 1 }),
      makeSingleChoice({ id: "orta", category: "verbal_analogy", difficulty: 2 }),
      makeSingleChoice({ id: "zor", category: "odd_one_out", difficulty: 3 }),
    ];

    expect(getTestQuestions(input).map((q) => q.id)).toEqual(["kolay", "orta", "zor"]);
  });

  it("çakışma varken zorluk sırasından en az sapmayı yapar", () => {
    // İki kolay soru aynı kategoriden: araya sıradaki farklı kategorili soru girer,
    // atlanan soru hemen ardından gelir.
    const input = [
      makeSingleChoice({ id: "kolay-1", category: "numeric_pattern", difficulty: 1 }),
      makeSingleChoice({ id: "kolay-2", category: "numeric_pattern", difficulty: 1 }),
      makeSingleChoice({ id: "orta-1", category: "verbal_analogy", difficulty: 2 }),
      makeSingleChoice({ id: "orta-2", category: "odd_one_out", difficulty: 2 }),
    ];

    expect(getTestQuestions(input).map((q) => q.id)).toEqual([
      "kolay-1",
      "orta-1",
      "kolay-2",
      "orta-2",
    ]);
  });

  it("tek kategori varsa sırayı bozmadan devam eder", () => {
    const input = [
      makeSingleChoice({ id: "t1", category: "numeric_pattern", difficulty: 1 }),
      makeSingleChoice({ id: "t2", category: "numeric_pattern", difficulty: 2 }),
      makeSingleChoice({ id: "t3", category: "numeric_pattern", difficulty: 3 }),
    ];

    expect(getTestQuestions(input).map((q) => q.id)).toEqual(["t1", "t2", "t3"]);
  });
});

describe("findAdjacentSameCategory", () => {
  it("ardışık aynı kategorileri bulur", () => {
    const input = [
      makeSingleChoice({ id: "x1", category: "numeric_pattern" }),
      makeSingleChoice({ id: "x2", category: "numeric_pattern" }),
      makeSingleChoice({ id: "x3", category: "verbal_analogy" }),
    ];

    expect(findAdjacentSameCategory(input)).toEqual(["x1 → x2 (numeric_pattern)"]);
  });
});

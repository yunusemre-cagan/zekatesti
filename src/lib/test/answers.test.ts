import { describe, expect, it } from "vitest";
import { submissionSchema } from "./answers";

describe("submissionSchema", () => {
  it("her tipten cevabı içeren geçerli gönderimi kabul eder", () => {
    const result = submissionSchema.safeParse({
      elapsedSec: 120,
      answers: {
        "numeric-pattern-01": { type: "single_choice", optionId: "c" },
        "spatial-01": { type: "multi_choice", optionIds: ["a", "c"] },
        "working-memory-01": { type: "memory_sequence", value: "814927" },
        "processing-speed-01": { type: "speed_task", responses: { i1: "3" } },
      },
    });
    expect(result.success).toBe(true);
  });

  it("bilinmeyen cevap tipini reddeder", () => {
    const result = submissionSchema.safeParse({
      elapsedSec: 0,
      answers: { "q-1": { type: "essay", value: "..." } },
    });
    expect(result.success).toBe(false);
  });

  it("geçersiz soru kimliğini reddeder", () => {
    const result = submissionSchema.safeParse({
      elapsedSec: 0,
      answers: { "../etc": { type: "single_choice", optionId: "a" } },
    });
    expect(result.success).toBe(false);
  });

  it("negatif süreyi reddeder", () => {
    expect(submissionSchema.safeParse({ elapsedSec: -1, answers: {} }).success).toBe(false);
  });

  it("aşırı uzun bellek cevabını reddeder", () => {
    const result = submissionSchema.safeParse({
      elapsedSec: 0,
      answers: { "q-1": { type: "memory_sequence", value: "1".repeat(1000) } },
    });
    expect(result.success).toBe(false);
  });
});

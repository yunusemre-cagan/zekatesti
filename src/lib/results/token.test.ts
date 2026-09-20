/**
 * İmzalı sonuç paketinin testleri.
 *
 * En kritik güvence: paketin içeriği değiştirilirse doğrulama başarısız olmalı. Aksi halde
 * bir kullanıcı "IQ 145" yazıp istatistikleri bozabilirdi.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createResultToken, verifyResultToken } from "./token";
import type { StoredQuestionResult, StoredResultSummary } from "./schema";

const summary: StoredResultSummary = {
  estimatedIq: 118,
  accuracyRatio: 0.7,
  scoreRatio: 0.68,
  totalSeconds: 720,
  questionCount: 54,
  correctCount: 38,
};

const questions: StoredQuestionResult[] = [
  { questionId: "sayisal-01", status: "correct", score: 1, seconds: 14 },
  { questionId: "matris-01", status: "wrong", score: 0, seconds: 30 },
];

afterEach(() => {
  vi.useRealTimers();
});

describe("createResultToken / verifyResultToken", () => {
  it("imzaladığı sonucu aynen geri verir", () => {
    const result = verifyResultToken(createResultToken(summary, questions));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).toMatchObject(summary);
    expect(result.payload.questions).toEqual(questions);
    expect(result.payload.resultId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("her paket için farklı bir sonuç kimliği üretir", () => {
    const first = verifyResultToken(createResultToken(summary, questions));
    const second = verifyResultToken(createResultToken(summary, questions));

    if (!first.ok || !second.ok) throw new Error("paketler doğrulanamadı");
    expect(first.payload.resultId).not.toBe(second.payload.resultId);
  });

  it("gövdesi değiştirilmiş paketi reddeder", () => {
    const token = createResultToken(summary, questions);
    const [body, signature] = token.split(".");

    // IQ değeri 145 yapılmış sahte bir gövde, gerçek imzayla birleştiriliyor.
    const tampered = JSON.parse(Buffer.from(body!, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    tampered.estimatedIq = 145;
    const fakeBody = Buffer.from(JSON.stringify(tampered), "utf8").toString("base64url");

    const result = verifyResultToken(`${fakeBody}.${signature}`);
    expect(result.ok).toBe(false);
  });

  it("imzası bozulmuş paketi reddeder", () => {
    const token = createResultToken(summary, questions);
    expect(verifyResultToken(`${token}xyz`).ok).toBe(false);
  });

  it("biçimi bozuk paketi reddeder", () => {
    expect(verifyResultToken("imzasiz-metin").ok).toBe(false);
    expect(verifyResultToken("").ok).toBe(false);
  });

  it("süresi dolmuş paketi reddeder", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
    const token = createResultToken(summary, questions);

    // Paketin ömrü 2 saat; 3 saat sonra geçersiz olmalı.
    vi.setSystemTime(new Date("2026-01-01T13:00:00Z"));
    const result = verifyResultToken(token);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("süresi");
  });
});

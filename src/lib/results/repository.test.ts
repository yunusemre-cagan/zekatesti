/**
 * Sonuç deposunun ve istatistik hesabının testleri.
 *
 * Dosya tabanlı uygulama üzerinden çalışır; istatistik mantığı iki uygulamada da aynı
 * kurallara dayanır (her katılımcının yalnızca ilk denemesi sayılır).
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createJsonResultsRepository, type SaveResultInput } from "./repository";

let tempDir: string;
let filePath: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "iq-results-test-"));
  filePath = path.join(tempDir, "results.json");
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

function makeResult(overrides: Partial<SaveResultInput> = {}): SaveResultInput {
  return {
    id: crypto.randomUUID(),
    participantId: crypto.randomUUID(),
    estimatedIq: 110,
    accuracyRatio: 0.6,
    scoreRatio: 0.58,
    totalSeconds: 600,
    questionCount: 2,
    correctCount: 1,
    demographics: {},
    questions: [
      { questionId: "soru-1", status: "correct", score: 1, seconds: 20 },
      { questionId: "soru-2", status: "wrong", score: 0, seconds: 40 },
    ],
    ...overrides,
  };
}

describe("createJsonResultsRepository", () => {
  it("kayıt yokken boş istatistik döner", async () => {
    const repo = createJsonResultsRepository(filePath);
    const stats = await repo.getStats();

    expect(stats.overall.participantCount).toBe(0);
    expect(stats.overall.averageIq).toBe(0);
    expect(stats.questions).toEqual([]);
  });

  it("kaydedilen sonucu istatistiklere yansıtır", async () => {
    const repo = createJsonResultsRepository(filePath);
    await repo.save(makeResult({ estimatedIq: 120 }));

    const stats = await repo.getStats();
    expect(stats.overall.participantCount).toBe(1);
    expect(stats.overall.averageIq).toBe(120);
    expect(stats.questions).toHaveLength(2);
  });

  it("aynı kimlikli sonucu iki kez kaydetmez", async () => {
    const repo = createJsonResultsRepository(filePath);
    const result = makeResult();
    await repo.save(result);
    await repo.save(result);

    expect((await repo.getStats()).overall.participantCount).toBe(1);
  });

  it("bir katılımcının yalnızca ilk denemesini sayar", async () => {
    const repo = createJsonResultsRepository(filePath);
    const participantId = crypto.randomUUID();

    await repo.save(makeResult({ participantId, estimatedIq: 100 }));
    await repo.save(makeResult({ participantId, estimatedIq: 145 }));

    const stats = await repo.getStats();
    expect(stats.overall.participantCount).toBe(1);
    // İkinci (yüksek) deneme ortalamayı yukarı çekmemeli.
    expect(stats.overall.averageIq).toBe(100);
  });

  it("farklı katılımcıların ortalamasını alır", async () => {
    const repo = createJsonResultsRepository(filePath);
    await repo.save(makeResult({ estimatedIq: 100 }));
    await repo.save(makeResult({ estimatedIq: 120 }));

    const stats = await repo.getStats();
    expect(stats.overall.participantCount).toBe(2);
    expect(stats.overall.averageIq).toBe(110);
  });

  it("soru bazında doğru oranını ve ortalama süreyi hesaplar", async () => {
    const repo = createJsonResultsRepository(filePath);
    await repo.save(makeResult());
    await repo.save(
      makeResult({
        questions: [
          { questionId: "soru-1", status: "wrong", score: 0, seconds: 40 },
          { questionId: "soru-2", status: "correct", score: 1, seconds: 10 },
        ],
      }),
    );

    const stats = await repo.getStats();
    const first = stats.questions.find((q) => q.questionId === "soru-1");
    expect(first).toMatchObject({ answerCount: 2, correctRatio: 0.5, averageSeconds: 30 });
  });

  it("kısmi puanlı cevapları doğru saymaz", async () => {
    const repo = createJsonResultsRepository(filePath);
    await repo.save(
      makeResult({
        questions: [{ questionId: "hiz-01", status: "partial", score: 0.5, seconds: 30 }],
      }),
    );

    const stats = await repo.getStats();
    expect(stats.questions[0]).toMatchObject({ questionId: "hiz-01", correctRatio: 0 });
  });

  it("isteğe bağlı bilgileri saklar", async () => {
    const repo = createJsonResultsRepository(filePath);
    await repo.save(
      makeResult({ demographics: { birthYear: 1995, gender: "kadin", provinceCode: 34 } }),
    );

    // Bilgiler istatistiklerde yayınlanmaz; yalnızca kayıtta tutulur.
    expect((await repo.getStats()).overall.participantCount).toBe(1);
  });
});

/**
 * API route testleri.
 *
 * Route handler'lar doğrudan çağrılır (HTTP sunucusu ayağa kaldırılmaz) ve gerçek
 * `data/questions.json` dosyası üzerinden çalışır; böylece veri, puanlama ve route
 * katmanının birlikte çalıştığı uçtan uca doğrulanmış olur.
 */
import { describe, expect, it } from "vitest";
import type { TestStartResponse, TestSubmitResponse } from "@/lib/api/contracts";
import { TEST_SAFETY_LIMIT_SEC } from "@/lib/config";
import { questionRepository } from "@/lib/questions/repository";
import type { Question } from "@/lib/questions/schema";
import type { AnswerMap } from "@/lib/test/answers";
import { GET } from "./start/route";
import { POST } from "./submit/route";

/** Gönderim isteğini, route handler'ın beklediği biçimde oluşturur. */
function submitRequest(body: unknown): Request {
  return new Request("http://localhost/api/test/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Bir soru için doğru cevabı üretir (yalnızca testte; cevap anahtarı sunucu tarafındadır). */
function correctAnswerFor(question: Question): AnswerMap[string] {
  switch (question.type) {
    case "single_choice":
      return { type: "single_choice", optionId: question.correctOptionId };
    case "multi_choice":
      return { type: "multi_choice", optionIds: question.correctOptionIds };
    case "memory_sequence": {
      const sequence =
        question.transform === "reverse"
          ? question.sequence.toReversed()
          : question.transform === "sorted"
            ? question.sequence.toSorted()
            : question.sequence;
      return { type: "memory_sequence", value: sequence.join("") };
    }
    case "speed_task":
      return {
        type: "speed_task",
        responses: Object.fromEntries(question.items.map((item) => [item.id, item.correctOptionId])),
      };
  }
}

describe("GET /api/test/start", () => {
  it("aktif soruları emniyet sınırıyla birlikte döner", async () => {
    const response = await GET();
    const body = (await response.json()) as TestStartResponse;

    expect(response.status).toBe(200);
    expect(body.safetyLimitSec).toBe(TEST_SAFETY_LIMIT_SEC);
    expect(body.questions.length).toBeGreaterThan(0);
  });

  it("soruları kolaydan zora sıralar", async () => {
    const body = (await (await GET()).json()) as TestStartResponse;
    const all = await questionRepository.getAll();
    const difficulties = body.questions.map(
      (q) => all.find((source) => source.id === q.id)?.difficulty ?? 0,
    );
    expect(difficulties).toEqual(difficulties.toSorted((a, b) => a - b));
  });

  it("yanıtın hiçbir yerinde doğru cevap veya açıklama bulunmaz", async () => {
    const raw = await (await GET()).text();
    for (const key of ["correctOptionId", "correctOptionIds", "explanation"]) {
      expect(raw).not.toContain(`"${key}"`);
    }
  });

  it("pasif soruları göndermez", async () => {
    const body = (await (await GET()).json()) as TestStartResponse;
    const all = await questionRepository.getAll();
    const inactiveIds = all.filter((q) => !q.active).map((q) => q.id);
    expect(body.questions.filter((q) => inactiveIds.includes(q.id))).toEqual([]);
  });
});

describe("POST /api/test/submit", () => {
  it("geçersiz JSON gövdesini 400 ile reddeder", async () => {
    const response = await POST(submitRequest("{bozuk"));
    expect(response.status).toBe(400);
  });

  it("şemaya uymayan gönderimi 400 ve ayrıntıyla reddeder", async () => {
    const response = await POST(submitRequest({ durations: { "q-1": -5 }, answers: {} }));
    const body = (await response.json()) as { error: string; details?: string[] };

    expect(response.status).toBe(400);
    expect(body.details?.length).toBeGreaterThan(0);
  });

  it("boş gönderimde sıfır puan ve tam sayı IQ döner", async () => {
    const response = await POST(submitRequest({ durations: {}, answers: {} }));
    const body = (await response.json()) as TestSubmitResponse;

    expect(response.status).toBe(200);
    expect(body.correctCount).toBe(0);
    expect(body.scoreRatio).toBe(0);
    expect(Number.isInteger(body.estimatedIq)).toBe(true);
    expect(Number.isInteger(body.percentile)).toBe(true);
  });

  it("tüm cevaplar doğruysa tam puan ve soru sayısı kadar doğru döner", async () => {
    const questions = (await questionRepository.getAll()).filter((q) => q.active);
    const answers: AnswerMap = Object.fromEntries(
      questions.map((question) => [question.id, correctAnswerFor(question)]),
    );

    const response = await POST(submitRequest({ durations: {}, answers }));
    const body = (await response.json()) as TestSubmitResponse;

    expect(body.scoreRatio).toBe(1);
    expect(body.correctCount).toBe(questions.length);
    expect(body.totalQuestions).toBe(questions.length);
    expect(body.categories.every((category) => category.ratio === 1)).toBe(true);
  });

  it("gönderilen soru sürelerini toplar ve hızı puana yansıtır", async () => {
    const questions = (await questionRepository.getAll()).filter((q) => q.active);
    const answers: AnswerMap = Object.fromEntries(
      questions.map((question) => [question.id, correctAnswerFor(question)]),
    );
    // Her soru, kayıt üst sınırına kadar uzun sürmüş gibi gönderiliyor.
    const durations = Object.fromEntries(questions.map((question) => [question.id, 600]));

    const response = await POST(submitRequest({ durations, answers }));
    const body = (await response.json()) as TestSubmitResponse;

    expect(body.totalSeconds).toBe(questions.length * 300); // üst sınırla kırpılmış
    expect(body.accuracyRatio).toBe(1);
    expect(body.scoreRatio).toBeLessThan(1); // yavaşlık puanı düşürdü
    expect(body.slowQuestionCount).toBeGreaterThan(0);
  });
});

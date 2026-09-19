/**
 * GET /api/test/start — Teste girecek soruları döner.
 *
 * Sorular, doğru cevapları ve çözüm açıklamaları çıkarılmış halde gönderilir
 * (bkz. lib/questions/sanitize.ts). Puanlama yalnızca /api/test/submit içinde, sunucuda yapılır.
 *
 * Kullanım: Test ekranı (/test) açıldığında bu route'u çağırır.
 */
import { TEST_SAFETY_LIMIT_SEC } from "@/lib/config";
import { internalError } from "@/lib/api/responses";
import type { TestStartResponse } from "@/lib/api/contracts";
import { questionRepository } from "@/lib/questions/repository";
import { toPublicQuestion } from "@/lib/questions/sanitize";
import { getTestQuestions } from "@/lib/test/ordering";

/**
 * Yanıt önbelleğe alınmaz: admin panelinde eklenen bir soru, yeniden deploy beklemeden
 * bir sonraki testte görünmelidir.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const questions = getTestQuestions(await questionRepository.getAll());
    const body: TestStartResponse = {
      safetyLimitSec: TEST_SAFETY_LIMIT_SEC,
      questions: questions.map(toPublicQuestion),
    };
    return Response.json(body);
  } catch (error) {
    return internalError("GET /api/test/start", error);
  }
}

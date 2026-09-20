/**
 * POST /api/test/submit — Gönderilen cevapları puanlar ve sonuç özetini döner.
 *
 * Puanlama bilinçli olarak sunucuda yapılır: doğru cevaplar hiçbir zaman tarayıcıya gitmediği
 * için sonuç, istemci tarafında hesaplanamaz ve değiştirilemez.
 *
 * Sorular gönderim anında yeniden okunur. Test sırasında admin panelinden bir soru eklenirse
 * veya pasife alınırsa, kullanıcının görmediği sorular cevapsız sayılır; bu nadir durum,
 * cevap anahtarını istemciye göndermemenin kabul edilebilir bir bedelidir.
 *
 * Kullanım: Test ekranı, süre dolduğunda veya kullanıcı testi bitirdiğinde bu route'u çağırır.
 */
import { internalError, jsonError } from "@/lib/api/responses";
import type { TestSubmitResponse } from "@/lib/api/contracts";
import { isResultStorageEnabled } from "@/lib/results/repository";
import { createResultToken } from "@/lib/results/token";
import { questionRepository } from "@/lib/questions/repository";
import { scoreTest } from "@/lib/scoring/score-test";
import { submissionSchema } from "@/lib/test/answers";
import { getTestQuestions } from "@/lib/test/ordering";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "İstek gövdesi geçerli bir JSON değil.");
  }

  // İstemciden gelen veri güvenilmezdir; puanlamadan önce şemaya göre doğrulanır.
  const parsed = submissionSchema.safeParse(payload);
  if (!parsed.success) {
    const details = parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "(kök)"}: ${issue.message}`,
    );
    return jsonError(400, "Gönderilen cevaplar geçersiz.", details);
  }

  try {
    const questions = getTestQuestions(await questionRepository.getAll());
    const result = scoreTest(questions, parsed.data.answers, parsed.data.durations);

    /**
     * Sonuç burada KAYDEDİLMEZ. Kullanıcı sonuç ekranında açıkça onay verirse kaydedilir.
     * Onay isteğinde gönderilen sayılara güvenilemeyeceği için sonuç imzalanıp tarayıcıya
     * verilir; kayıt sırasında imza doğrulanır (bkz. lib/results/token.ts).
     */
    const body: TestSubmitResponse = {
      ...result,
      ...(isResultStorageEnabled() && {
        resultToken: createResultToken(
          {
            estimatedIq: result.estimatedIq,
            accuracyRatio: result.accuracyRatio,
            scoreRatio: result.scoreRatio,
            totalSeconds: result.totalSeconds,
            questionCount: result.totalQuestions,
            correctCount: result.correctCount,
          },
          result.questions.map((question) => ({
            questionId: question.questionId,
            status: question.status,
            score: question.score,
            seconds: question.seconds,
          })),
        ),
      }),
    };

    return Response.json(body);
  } catch (error) {
    return internalError("POST /api/test/submit", error);
  }
}

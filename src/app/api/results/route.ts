/**
 * POST /api/results — Kullanıcı onay verdiyse test sonucunu kaydeder.
 *
 * Gizlilik: Bu route yalnızca kullanıcı sonuç ekranındaki onay kutusunu işaretlediğinde
 * çağrılır. Onay verilmezse hiçbir kayıt oluşmaz. IP adresi, tarayıcı bilgisi veya başka
 * bir kimlik verisi saklanmaz.
 *
 * Güvenlik: Kaydedilen puanlar istekten değil, sunucunun kendi imzaladığı paketten alınır
 * (bkz. lib/results/token.ts). Böylece uydurma sonuçlarla istatistikler bozulamaz.
 * İstekten alınan tek şey, kullanıcının kendi girdiği isteğe bağlı bilgilerdir.
 *
 * Kullanım: Sonuç ekranındaki "Sonucumu istatistiklere ekle" formu.
 */
import { z } from "zod";
import { jsonError, internalError } from "@/lib/api/responses";
import { isResultStorageEnabled, resultsRepository } from "@/lib/results/repository";
import { demographicsSchema } from "@/lib/results/schema";
import { verifyResultToken } from "@/lib/results/token";

export const dynamic = "force-dynamic";

const requestSchema = z
  .object({
    resultToken: z.string().min(1).max(200_000),
    /** Tarayıcıda üretilen rastgele kimlik; kişiye değil tarayıcıya aittir. */
    participantId: z.uuid(),
  })
  .and(demographicsSchema);

export async function POST(request: Request): Promise<Response> {
  if (!isResultStorageEnabled()) {
    return jsonError(503, "Sonuç kaydı bu ortamda kapalı.");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "İstek gövdesi geçerli bir JSON değil.");
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(
      400,
      "Gönderilen bilgiler geçersiz.",
      parsed.error.issues.map((issue) => `${issue.path.map(String).join(".")}: ${issue.message}`),
    );
  }

  const verification = verifyResultToken(parsed.data.resultToken);
  if (!verification.ok) {
    return jsonError(400, verification.error);
  }

  const { payload: result } = verification;

  try {
    await resultsRepository.save({
      id: result.resultId,
      participantId: parsed.data.participantId,
      estimatedIq: result.estimatedIq,
      accuracyRatio: result.accuracyRatio,
      scoreRatio: result.scoreRatio,
      totalSeconds: result.totalSeconds,
      questionCount: result.questionCount,
      correctCount: result.correctCount,
      questions: result.questions,
      demographics: {
        ...(parsed.data.birthYear !== undefined && { birthYear: parsed.data.birthYear }),
        ...(parsed.data.gender !== undefined && { gender: parsed.data.gender }),
        ...(parsed.data.provinceCode !== undefined && { provinceCode: parsed.data.provinceCode }),
      },
    });

    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return internalError("POST /api/results", error);
  }
}

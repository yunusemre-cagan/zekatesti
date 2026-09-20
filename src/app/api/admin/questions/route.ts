/**
 * POST /api/admin/questions — Yeni soru ekler.
 *
 * Gövde, tam bir soru nesnesidir ve `questionSchema` ile doğrulanır; doğrulamadan geçmeyen
 * hiçbir veri dosyaya yazılmaz. Aynı kimlikte soru varsa 409 döner.
 *
 * Kullanım: Admin panelindeki "Yeni soru" formu.
 */
import { guardAdminWrite, toErrorResponse } from "@/lib/api/admin-guard";
import { jsonError } from "@/lib/api/responses";
import { questionRepository } from "@/lib/questions/repository";
import { questionSchema } from "@/lib/questions/schema";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const denied = await guardAdminWrite();
  if (denied !== undefined) return denied;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "İstek gövdesi geçerli bir JSON değil.");
  }

  const parsed = questionSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(
      400,
      "Soru geçersiz.",
      parsed.error.issues.map((issue) => `${issue.path.map(String).join(".")}: ${issue.message}`),
    );
  }

  try {
    await questionRepository.create(parsed.data);
    return Response.json({ ok: true, id: parsed.data.id }, { status: 201 });
  } catch (error) {
    return toErrorResponse("POST /api/admin/questions", error);
  }
}

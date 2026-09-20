/**
 * PUT /api/admin/questions/[id]    — Soruyu günceller.
 * DELETE /api/admin/questions/[id] — Soruyu siler.
 *
 * Kimlik değiştirilemez: gövdedeki kimlik adresteki kimlikle aynı olmak zorundadır.
 * Aksi halde düzenleme sırasında yanlışlıkla ikinci bir soru oluşabilirdi.
 *
 * Kullanım: Admin panelindeki düzenleme formu ve liste ekranındaki silme butonu.
 */
import { guardAdminWrite, toErrorResponse } from "@/lib/api/admin-guard";
import { jsonError } from "@/lib/api/responses";
import { questionRepository } from "@/lib/questions/repository";
import { questionSchema } from "@/lib/questions/schema";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  const denied = await guardAdminWrite();
  if (denied !== undefined) return denied;

  const { id } = await context.params;

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

  if (parsed.data.id !== id) {
    return jsonError(400, "Sorunun kimliği değiştirilemez.");
  }

  try {
    await questionRepository.update(parsed.data);
    return Response.json({ ok: true, id });
  } catch (error) {
    return toErrorResponse("PUT /api/admin/questions/[id]", error);
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<Response> {
  const denied = await guardAdminWrite();
  if (denied !== undefined) return denied;

  const { id } = await context.params;

  try {
    await questionRepository.delete(id);
    return Response.json({ ok: true, id });
  } catch (error) {
    return toErrorResponse("DELETE /api/admin/questions/[id]", error);
  }
}

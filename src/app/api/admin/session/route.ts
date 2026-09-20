/**
 * POST /api/admin/session — Admin girişi (şifre doğrulama, oturum çerezi yazma).
 * DELETE /api/admin/session — Çıkış.
 *
 * Şifre karşılaştırması ve çerez işlemleri lib/admin/auth.ts içindedir; bu route yalnızca
 * HTTP katmanıdır.
 *
 * Kullanım: /admin/login sayfasındaki giriş formu ve panelin çıkış butonu.
 */
import { jsonError } from "@/lib/api/responses";
import { isAdminConfigured, signIn, signOut } from "@/lib/admin/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const loginSchema = z.object({ password: z.string().min(1).max(200) });

export async function POST(request: Request): Promise<Response> {
  if (!isAdminConfigured()) {
    return jsonError(503, "ADMIN_PASSWORD tanımlı değil; admin paneli kapalı.");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "İstek gövdesi geçerli bir JSON değil.");
  }

  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(400, "Şifre girilmedi.");
  }

  if (!(await signIn(parsed.data.password))) {
    // Hangi kısmın yanlış olduğu belirtilmez (şifre deneme saldırılarına bilgi vermemek için).
    return jsonError(401, "Şifre hatalı.");
  }

  return Response.json({ ok: true });
}

export async function DELETE(): Promise<Response> {
  await signOut();
  return Response.json({ ok: true });
}

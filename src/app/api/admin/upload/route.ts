/**
 * POST /api/admin/upload — Soru görselini `public/questions/<soru-kimliği>/` altına kaydeder.
 *
 * İstek `multipart/form-data` biçimindedir: `questionId` ve `file` alanlarını taşır.
 * Yanıt, veri dosyasına yazılacak web yolunu döner (ör. "/questions/matris-01/a-1k2j.svg").
 *
 * Yalnızca yerel geliştirmede çalışır; Vercel'de dosya sistemi kalıcı değildir.
 *
 * Kullanım: Admin formundaki görsel yükleme alanları.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { guardAdminWrite } from "@/lib/api/admin-guard";
import { internalError, jsonError } from "@/lib/api/responses";
import { MAX_UPLOAD_BYTES, resolveUploadTarget } from "@/lib/admin/upload";

export const dynamic = "force-dynamic";

const PUBLIC_DIR = path.join(process.cwd(), "public");

export async function POST(request: Request): Promise<Response> {
  const denied = await guardAdminWrite();
  if (denied !== undefined) return denied;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError(400, "İstek biçimi geçersiz.");
  }

  const questionId = formData.get("questionId");
  const file = formData.get("file");

  if (typeof questionId !== "string" || !(file instanceof File)) {
    return jsonError(400, "Soru kimliği veya dosya eksik.");
  }

  const target = resolveUploadTarget(
    questionId,
    file.name,
    file.type,
    file.size,
    PUBLIC_DIR,
  );
  if (!target.ok) {
    return jsonError(400, target.error);
  }

  try {
    await mkdir(path.dirname(target.absolutePath), { recursive: true });
    const bytes = Buffer.from(await file.arrayBuffer());
    // Boyut, akış okunduktan sonra bir kez daha doğrulanır (istemcinin bildirdiği boyuta güvenilmez).
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      return jsonError(400, "Dosya 2 MB sınırını aşıyor.");
    }
    await writeFile(target.absolutePath, bytes);
    return Response.json({ ok: true, path: target.publicPath }, { status: 201 });
  } catch (error) {
    return internalError("POST /api/admin/upload", error);
  }
}

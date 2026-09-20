/**
 * Admin API route'ları için ortak kontroller.
 *
 * İki şey doğrulanır:
 *  1. İstek sahibi giriş yapmış mı (oturum çerezi geçerli mi)?
 *  2. Bu ortamda yazma açık mı? Vercel'de dosya sistemi kalıcı olmadığı için yazma yalnızca
 *     yerel geliştirmede açıktır (bkz. PLAN.md → "Neden Seçenek A?").
 *
 * Kullanım: /api/admin/* altındaki tüm route'lar, işe başlamadan önce çağırır.
 */
import { isAuthenticated } from "@/lib/admin/auth";
import { IS_WRITE_ENABLED } from "@/lib/config";
import {
  DuplicateQuestionIdError,
  QuestionDataError,
  QuestionNotFoundError,
  ReadOnlyRepositoryError,
} from "@/lib/questions/errors";
import { internalError, jsonError } from "./responses";

/**
 * Oturumu ve yazma iznini kontrol eder.
 * @returns Kontrol başarısızsa döndürülecek yanıt; başarılıysa `undefined`.
 */
export async function guardAdminWrite(): Promise<Response | undefined> {
  if (!(await isAuthenticated())) {
    return jsonError(401, "Bu işlem için giriş yapmanız gerekiyor.");
  }
  if (!IS_WRITE_ENABLED) {
    return jsonError(
      403,
      "Bu ortamda sorular değiştirilemez. Soru eklemek için projeyi yerelde çalıştırın.",
    );
  }
  return undefined;
}

/** Yalnızca oturumu kontrol eder (okuma işlemleri için). */
export async function guardAdminRead(): Promise<Response | undefined> {
  if (!(await isAuthenticated())) {
    return jsonError(401, "Bu işlem için giriş yapmanız gerekiyor.");
  }
  return undefined;
}

/**
 * Repository hatalarını uygun HTTP yanıtlarına çevirir.
 * Tanınmayan hatalar 500 olarak döner ve ayrıntısı yalnızca sunucu günlüğüne yazılır.
 */
export function toErrorResponse(context: string, error: unknown): Response {
  if (error instanceof QuestionNotFoundError) {
    return jsonError(404, error.message);
  }
  if (error instanceof DuplicateQuestionIdError) {
    return jsonError(409, error.message);
  }
  if (error instanceof ReadOnlyRepositoryError) {
    return jsonError(403, error.message);
  }
  if (error instanceof QuestionDataError) {
    return jsonError(500, "Soru dosyası okunamadı veya bozuk. Sunucu günlüğüne bakın.");
  }
  return internalError(context, error);
}

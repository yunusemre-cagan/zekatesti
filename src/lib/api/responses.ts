/**
 * Route handler'lar için ortak yanıt yardımcıları.
 *
 * Hata mesajlarının gövdesi her zaman aynı biçimdedir (`ApiErrorResponse`) ve beklenmeyen
 * hataların ayrıntısı (dosya yolları, yığın izi vb.) istemciye sızdırılmaz; yalnızca
 * sunucu günlüğüne yazılır.
 */
import type { ApiErrorResponse } from "./contracts";

export function jsonError(status: number, error: string, details?: string[]): Response {
  const body: ApiErrorResponse = { error, ...(details !== undefined && { details }) };
  return Response.json(body, { status });
}

/**
 * Beklenmeyen bir hatayı günlüğe yazar ve istemciye genel bir 500 yanıtı döner.
 * @param context Günlükte hatanın nereden geldiğini belirten kısa etiket.
 */
export function internalError(context: string, error: unknown): Response {
  console.error(`[${context}]`, error);
  return jsonError(500, "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.");
}

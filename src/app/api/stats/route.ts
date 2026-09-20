/**
 * GET /api/stats — Genel ortalamalar ve soru bazlı başarı oranları.
 *
 * Yalnızca "doğru yapma oranı" yayınlanır; hangi şıkkın kaç kez işaretlendiği
 * yayınlanmaz. Aksi halde bu veriden doğru cevap çıkarılabilirdi.
 *
 * İstatistikler her katılımcının yalnızca ilk denemesinden hesaplanır (bkz. repository).
 * Sonuç, kısa süreli olarak bellekte tutulur; sonuç ekranını her açan kullanıcı için
 * veritabanına gitmemek adına.
 *
 * Kullanım: Sonuç ekranı, soru bazlı ve genel karşılaştırmaları göstermek için çağırır.
 */
import { internalError } from "@/lib/api/responses";
import type { TestStatsResponse } from "@/lib/api/contracts";
import { isResultStorageEnabled, resultsRepository } from "@/lib/results/repository";

export const dynamic = "force-dynamic";

/** Önbellek süresi: 60 saniye. İstatistikler bu kadar gecikmeli olsa da sorun olmaz. */
const CACHE_TTL_MS = 60_000;

let cache: { data: TestStatsResponse; expiresAtMs: number } | undefined;

export async function GET(): Promise<Response> {
  if (!isResultStorageEnabled()) {
    // Veritabanı yoksa istatistik yok; arayüz bu durumu sessizce ele alır.
    const empty: TestStatsResponse = {
      overall: {
        participantCount: 0,
        averageIq: 0,
        averageAccuracyRatio: 0,
        averageTotalSeconds: 0,
      },
      questions: [],
    };
    return Response.json(empty);
  }

  if (cache !== undefined && cache.expiresAtMs > Date.now()) {
    return Response.json(cache.data);
  }

  try {
    const stats = await resultsRepository.getStats();
    cache = { data: stats, expiresAtMs: Date.now() + CACHE_TTL_MS };
    return Response.json(stats);
  } catch (error) {
    return internalError("GET /api/stats", error);
  }
}

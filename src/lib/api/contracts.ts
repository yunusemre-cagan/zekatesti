/**
 * API sözleşmeleri: sunucu ile tarayıcı arasında gidip gelen gövdelerin tipleri.
 *
 * Hem route handler'lar hem de istemci bileşenleri bu tipleri kullanır; böylece bir uçta
 * yapılan değişiklik diğer uçta derleme hatası olarak görünür.
 *
 * Kullanım: /api/test/* route'ları yanıt gövdesini bu tiplere göre üretir; test ekranı aynı tiplerle okur.
 */
import type { PublicQuestion } from "@/lib/questions/sanitize";
import type { TestResult } from "@/lib/scoring/score-test";
import type { TestStats } from "@/lib/results/schema";

/** GET /api/test/start yanıtı. */
export interface TestStartResponse {
  /**
   * Testin görünmeyen emniyet sınırı (saniye). Kullanıcıya gösterilmez; test bu süreyi
   * aşarsa (ör. sayfa açık unutulmuşsa) o ana kadarki cevaplarla otomatik gönderilir.
   */
  safetyLimitSec: number;
  /** Cevapları çıkarılmış sorular, test sırasıyla. */
  questions: PublicQuestion[];
}

/**
 * POST /api/test/submit yanıtı.
 *
 * `resultToken`, sunucunun imzaladığı sonuç paketidir. Kullanıcı sonuç ekranında onay
 * verirse bu paket /api/results adresine geri gönderilir ve kayıt oradan yapılır.
 * Sonuç saklama kapalıysa (veritabanı yoksa) bu alan gelmez ve onay formu gösterilmez.
 */
export type TestSubmitResponse = TestResult & { resultToken?: string };

/** POST /api/results isteğinin gövdesi. */
export interface SaveResultRequest {
  resultToken: string;
  /** Tarayıcıda saklanan rastgele katılımcı kimliği. */
  participantId: string;
  /** Üçü de isteğe bağlıdır; kullanıcı boş bırakabilir. */
  birthYear?: number;
  gender?: string;
  provinceCode?: number;
}

/** GET /api/stats yanıtı. */
export type TestStatsResponse = TestStats;

/** Başarısız isteklerde dönen gövde. */
export interface ApiErrorResponse {
  error: string;
  /** Doğrulama hatalarında, hangi alanların hatalı olduğunu gösteren ayrıntı. */
  details?: string[];
}

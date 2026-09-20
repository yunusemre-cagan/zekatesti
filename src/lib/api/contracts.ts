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

/** POST /api/test/submit yanıtı. */
export type TestSubmitResponse = TestResult;

/** Başarısız isteklerde dönen gövde. */
export interface ApiErrorResponse {
  error: string;
  /** Doğrulama hatalarında, hangi alanların hatalı olduğunu gösteren ayrıntı. */
  details?: string[];
}

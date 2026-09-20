/**
 * Soru bazlı süre ölçümünün puana dönüşmesi: "hız çarpanı".
 *
 * Çarpan = beklenen süre / harcanan süre; en fazla 1, en az QUESTION_TIME.SPEED_FACTOR_MIN.
 * Beklenen sürede veya daha hızlı çözen tam puan alır (hız için ek ödül verilmez, çünkü
 * bu doğru cevabın değerini 1'in üzerine çıkarır ve ölçek bozulurdu). Beklenenin iki katında
 * çözen yarı puan alır.
 *
 * İki istisna vardır:
 *  - Kendi temposu olan görevler (speed_task, nback_task): Öğeler sabit hızla aktığı veya
 *    süre sınırı bulunduğu için hız zaten görevin içinde ölçülür; ikinci kez cezalandırılmaz.
 *  - Süresi ölçülmemiş sorular: Çarpan 1 kabul edilir (cevap yoksa puan zaten 0'dır).
 *
 * Kullanım: score-test.ts her sorunun puanını bu çarpanla çarpar.
 */
import { QUESTION_TIME } from "@/lib/config";
import type { Question } from "@/lib/questions/schema";

/** Sorunun beklenen çözüm süresi (saniye): soruya özel değer varsa o, yoksa zorluğa göre. */
export function getExpectedSec(question: Question): number {
  return question.expectedSec ?? QUESTION_TIME.EXPECTED_SEC_BY_DIFFICULTY[question.difficulty];
}

/**
 * Harcanan süreyi kayıt üst sınırına göre kırpar.
 * Testi açık unutan kullanıcının tek bir sorusu tüm sonucu bozmasın diye uygulanır.
 */
export function capRecordedSec(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) return 0;
  return Math.min(seconds, QUESTION_TIME.MAX_RECORDED_SEC);
}

/**
 * Sorunun hız çarpanını (0.5–1 arası) hesaplar.
 * @param seconds Soruda harcanan süre. `undefined` ise ölçüm yok sayılır ve 1 döner.
 */
export function getSpeedFactor(question: Question, seconds: number | undefined): number {
  // Kendi temposu olan görevlerde çarpan uygulanmaz (çifte ceza olmaması için).
  if (question.type === "speed_task" || question.type === "nback_task") return 1;
  if (seconds === undefined) return 1;

  const spent = capRecordedSec(seconds);
  // Çok kısa süreler (ör. soruya bakıp hemen geçme) bölmeyi patlatmasın diye taban 1 saniyedir.
  if (spent <= 1) return 1;

  const expected = getExpectedSec(question);
  const factor = expected / spent;
  return Math.min(1, Math.max(QUESTION_TIME.SPEED_FACTOR_MIN, factor));
}

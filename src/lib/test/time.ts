/**
 * Süre hesapları ve biçimlendirme.
 *
 * Kalan süre, sayaç değişkeninden değil her zaman başlangıç anından hesaplanır; böylece
 * sekme arka plana alındığında veya sayfa yenilendiğinde süre kaymaz.
 *
 * Kullanım: use-countdown.ts hook'u ve süre gösteren bileşenler (Timer, hız görevi, sonuç ekranı).
 */

/** Başlangıç anına göre kalan saniye (asla negatif olmaz). */
export function getRemainingSec(startedAtMs: number, durationSec: number, nowMs: number): number {
  const elapsedSec = (nowMs - startedAtMs) / 1000;
  return Math.max(0, Math.ceil(durationSec - elapsedSec));
}

/** Başlangıç anına göre geçen saniye. */
export function getElapsedSec(startedAtMs: number, nowMs: number): number {
  return Math.max(0, Math.round((nowMs - startedAtMs) / 1000));
}

/** Saniyeyi "dd:ss" (veya 1 saatten uzunsa "s:dd:ss") biçiminde gösterir. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  const ss = String(secs).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

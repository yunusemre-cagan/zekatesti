/**
 * Ağırlıklı başarı oranından tahmini IQ ve yüzdelik dilim hesaplar.
 *
 * ÖNEMLİ: Bu bir tahmindir, klinik bir ölçüm değildir. Dönüşüm, gerçek norm verisi yerine
 * `IQ_SCALE` içindeki varsayımlara dayanır (ayrıntı için bkz. src/lib/config.ts).
 *
 * Kullanım: score-test.ts, ağırlıklı başarı oranını sonuca dönüştürürken çağırır.
 */
import { IQ_SCALE } from "@/lib/config";

/**
 * Başarı oranını (0–1) tahmini IQ değerine çevirir.
 * Sonuç tam sayıya yuvarlanır ve [IQ_SCALE.MIN, IQ_SCALE.MAX] aralığına sınırlanır.
 */
export function estimateIq(scoreRatio: number): number {
  const ratio = clamp(scoreRatio, 0, 1);
  const zScore = (ratio - IQ_SCALE.EXPECTED_SCORE_MEAN) / IQ_SCALE.EXPECTED_SCORE_SD;
  const iq = IQ_SCALE.MEAN + zScore * IQ_SCALE.STANDARD_DEVIATION;
  return Math.round(clamp(iq, IQ_SCALE.MIN, IQ_SCALE.MAX));
}

/**
 * IQ değerinin nüfusun yüzde kaçından yüksek olduğunu tahmin eder (ör. 115 → 84).
 * Kullanıcıya "%0'dan yüksek" veya "%100'den yüksek" gibi anlamsız ifadeler gösterilmemesi
 * için sonuç 1–99 aralığına sınırlanır.
 */
export function iqToPercentile(iq: number): number {
  const zScore = (iq - IQ_SCALE.MEAN) / IQ_SCALE.STANDARD_DEVIATION;
  return clamp(Math.round(standardNormalCdf(zScore) * 100), 1, 99);
}

/**
 * Standart normal dağılımın birikimli dağılım fonksiyonu, Φ(z).
 * JavaScript'te yerleşik `erf` bulunmadığı için Abramowitz & Stegun 7.1.26 yaklaşımı
 * kullanılır (mutlak hata < 1.5 × 10⁻⁷, burada fazlasıyla yeterli).
 */
function standardNormalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const polynomial =
    t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - polynomial * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Şıkların sırasını, rastgeleliğe başvurmadan karıştırır.
 *
 * Neden rastgele değil: Sıra her render'da yeniden hesaplandığı için `Math.random()`
 * kullanılsaydı şıklar kullanıcı bakarken yerinden oynardı. Burada sıra, yalnızca "tohum"
 * değerinden (madde numarası) türetilir; aynı madde her zaman aynı dizilimi verir, farklı
 * maddeler ise farklı dizilim alır. Ayrıca tüm kullanıcılar aynı sırayı gördüğü için
 * sonuçlar karşılaştırılabilir kalır.
 *
 * Kullanım: SpeedTaskView, `shuffleOptions` açık olan hız görevlerinde her madde için çağırır.
 */

/**
 * Diziyi, tohuma göre belirlenen sabit bir düzende karıştırır (Fisher-Yates + basit LCG).
 * Girdi dizisini değiştirmez.
 */
export function shuffleWithSeed<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  // Doğrusal eşlenik üreteç (LCG): küçük, hızlı ve deterministik bir sayı dizisi verir.
  let state = (seed + 1) * 2654435761;

  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    const swapWith = state % (index + 1);
    const current = result[index]!;
    result[index] = result[swapWith]!;
    result[swapWith] = current;
  }
  return result;
}

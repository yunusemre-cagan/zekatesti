/**
 * Uygulama genelindeki sabit ayarlar.
 *
 * Test süresi, IQ dönüşüm parametreleri gibi "ayarlanabilir" değerler tek bir yerde
 * tutulur; böylece iş mantığı içinde sihirli sayılar (magic numbers) bulunmaz.
 *
 * Kullanım: Açılış sayfası (süre gösterimi), /api/test/start (süre), puanlama modülleri
 * (IQ dönüşümü) ve repository (yazma izni) bu sabitleri okur.
 */

/**
 * Testin görünmeyen emniyet sınırı (saniye).
 *
 * Testte geri sayım yoktur; süre soru bazında ölçülür (bkz. QUESTION_TIME). Bu sınır yalnızca
 * testin açık unutulması durumunda devreye girer ve testi o ana kadarki cevaplarla gönderir.
 */
export const TEST_SAFETY_LIMIT_SEC = 45 * 60;

/**
 * Soru bazlı süre ölçümünün parametreleri.
 *
 * Harcanan süre puanı doğrudan etkiler: her sorunun puanı, hız çarpanıyla çarpılır
 * (bkz. lib/scoring/speed-factor.ts). Parametreler burada toplanır ki puanlamanın
 * "sertliği" tek yerden ayarlanabilsin.
 */
export const QUESTION_TIME = {
  /** Zorluğa göre beklenen çözüm süresi (saniye). Soru bazında `expectedSec` ile değiştirilebilir. */
  EXPECTED_SEC_BY_DIFFICULTY: { 1: 45, 2: 75, 3: 120 } as Record<1 | 2 | 3, number>,

  /**
   * Bir soru için kaydedilebilecek en uzun süre (saniye).
   * Kullanıcı testi açık unutup başka bir işe giderse, tek bir sorunun süresi tüm sonucu
   * bozmasın diye kayıt bu değerde kesilir.
   */
  MAX_RECORDED_SEC: 300,

  /**
   * Hız çarpanının alt sınırı. Doğru ama çok yavaş verilen bir cevap en fazla bu orana düşer;
   * böylece doğru bilen yavaş kullanıcı, yanlış yapan hızlı kullanıcının önünde kalır.
   */
  SPEED_FACTOR_MIN: 0.5,
} as const;

/**
 * Ağırlıklı başarı oranını tahmini IQ değerine çevirirken kullanılan parametreler.
 *
 * IQ ölçeği ortalaması 100, standart sapması 15 olan normal dağılım varsayar.
 * Elimizde gerçek bir norm (kalibrasyon) verisi olmadığı için "ortalama bir katılımcının
 * ağırlıklı başarı oranı" ve bu oranın standart sapması varsayım olarak girilir:
 *   z  = (oran − EXPECTED_SCORE_MEAN) / EXPECTED_SCORE_SD
 *   IQ = MEAN + z × STANDARD_DEVIATION
 * Bu varsayımlarla %50 başarı → 100, %100 başarı → ~144 olur. Gerçek katılımcı verisi
 * toplandığında yalnızca bu iki değerin güncellenmesi yeterlidir.
 *
 * Sonuç, uç değerlerin anlamsız görünmemesi için [MIN, MAX] aralığına sınırlanır.
 */
export const IQ_SCALE = {
  MEAN: 100,
  STANDARD_DEVIATION: 15,
  MIN: 70,
  MAX: 145,
  EXPECTED_SCORE_MEAN: 0.5,
  EXPECTED_SCORE_SD: 0.17,
} as const;

/**
 * Admin panelinden dosyaya yazma işlemlerine izin verilip verilmediği.
 *
 * Vercel'de çalışma anında dosya sistemi kalıcı olmadığı için yazma işlemleri
 * yalnızca yerel geliştirme ortamında (`npm run dev`) açıktır. Ayrıntı: PLAN.md → "Neden Seçenek A?"
 */
export const IS_WRITE_ENABLED = process.env.NODE_ENV === "development";

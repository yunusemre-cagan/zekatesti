/**
 * Uygulama genelindeki sabit ayarlar.
 *
 * Test süresi, IQ dönüşüm parametreleri gibi "ayarlanabilir" değerler tek bir yerde
 * tutulur; böylece iş mantığı içinde sihirli sayılar (magic numbers) bulunmaz.
 */

/** Testin toplam süresi (saniye). Süre dolduğunda test otomatik gönderilir. */
export const TEST_DURATION_SEC = 30 * 60;

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

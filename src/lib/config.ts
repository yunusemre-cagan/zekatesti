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
 * IQ ölçeği ortalaması 100, standart sapması 15 olan normal dağılım varsayar.
 * Sonuç, uç değerlerin anlamsız görünmemesi için [MIN, MAX] aralığına sınırlanır.
 */
export const IQ_SCALE = {
  MEAN: 100,
  STANDARD_DEVIATION: 15,
  MIN: 70,
  MAX: 145,
} as const;

/**
 * Admin panelinden dosyaya yazma işlemlerine izin verilip verilmediği.
 *
 * Vercel'de çalışma anında dosya sistemi kalıcı olmadığı için yazma işlemleri
 * yalnızca yerel geliştirme ortamında (`npm run dev`) açıktır. Ayrıntı: PLAN.md → "Neden Seçenek A?"
 */
export const IS_WRITE_ENABLED = process.env.NODE_ENV === "development";

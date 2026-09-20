/**
 * Katılımcı kimliği: tarayıcıda saklanan rastgele bir değer.
 *
 * Ne değildir: Kişiyi tanımlayan bir bilgi değildir. İçinde ad, e-posta veya cihaz bilgisi
 * yoktur; `crypto.randomUUID()` ile üretilir ve yalnızca aynı tarayıcıdan yapılan tekrar
 * denemeleri ayırt etmeye yarar (istatistiklere her katılımcının yalnızca ilk denemesi girer).
 *
 * `localStorage` kullanılır, çünkü kimliğin oturum kapandıktan sonra da kalması gerekir.
 * Tarayıcı verisi silinirse yeni bir kimlik üretilir; bu kabul edilen bir sınırlamadır,
 * çünkü kullanıcıdan giriş yapması istenmiyor.
 *
 * Kullanım: Sonuç ekranındaki onay formu, kaydı gönderirken bu kimliği ekler.
 */

const STORAGE_KEY = "iq-test-participant-id";

/** Mevcut kimliği döner; yoksa üretip saklar. Saklama çalışmazsa geçici kimlik döner. */
export function getOrCreateParticipantId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing !== null && existing !== "") return existing;

    const created = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    // Gizli sekme veya kapalı site verisi: kimlik saklanamaz, tek seferlik üretilir.
    return crypto.randomUUID();
  }
}

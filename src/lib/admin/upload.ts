/**
 * Soru görsellerinin yüklenmesiyle ilgili kurallar ve dosya adı üretimi.
 *
 * Güvenlik: Yüklenen dosyanın adı kullanıcıdan geldiği için doğrudan kullanılmaz. Ad
 * temizlenir, uzantı izin verilen listeden seçilir ve dosya her zaman
 * `public/questions/<soru-kimliği>/` altına yazılır. Böylece ".." gibi ifadelerle klasör
 * dışına çıkılamaz.
 *
 * Kullanım: /api/admin/upload route'u; kurallar (boyut, tip) admin arayüzünde de gösterilir.
 */
import path from "node:path";

/** Kabul edilen dosya tipleri ve karşılık gelen uzantılar. */
const ALLOWED_TYPES: Record<string, string> = {
  "image/svg+xml": "svg",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** En büyük dosya boyutu (2 MB). Soru görselleri için fazlasıyla yeterlidir. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export const ALLOWED_UPLOAD_TYPES = Object.keys(ALLOWED_TYPES);

export type UploadTarget =
  | { ok: true; absolutePath: string; publicPath: string }
  | { ok: false; error: string };

/**
 * Yüklenecek dosya için hedef yolu hesaplar.
 *
 * @param questionId Görselin bağlı olduğu sorunun kimliği (şemadaki biçimde olmalı).
 * @param originalName Kullanıcının yüklediği dosyanın adı (yalnızca ipucu olarak kullanılır).
 * @param mimeType Dosyanın tipi; uzantı buradan belirlenir.
 * @param sizeBytes Dosya boyutu.
 * @param publicDir `public/` klasörünün mutlak yolu.
 */
export function resolveUploadTarget(
  questionId: string,
  originalName: string,
  mimeType: string,
  sizeBytes: number,
  publicDir: string,
): UploadTarget {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(questionId)) {
    return { ok: false, error: "Önce sorunun kimliğini girin (ör. 'matris-01')." };
  }

  const extension = ALLOWED_TYPES[mimeType];
  if (extension === undefined) {
    return { ok: false, error: "Yalnızca SVG, PNG, JPG, WEBP ve GIF dosyaları yüklenebilir." };
  }

  if (sizeBytes <= 0) {
    return { ok: false, error: "Dosya boş." };
  }
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Dosya 2 MB sınırını aşıyor." };
  }

  const fileName = `${toSafeBaseName(originalName)}.${extension}`;
  const publicPath = `/questions/${questionId}/${fileName}`;

  return {
    ok: true,
    absolutePath: path.join(publicDir, "questions", questionId, fileName),
    publicPath,
  };
}

/**
 * Dosya adını güvenli bir tabana indirger: küçük harf, rakam ve tire.
 * Ad tamamen kullanılamaz hale gelirse zaman damgası kullanılır (ör. iki dosya çakışmasın diye
 * adın sonuna kısa bir sayı eklenir).
 */
function toSafeBaseName(originalName: string): string {
  const withoutExtension = path.basename(originalName).replace(/\.[^.]*$/, "");
  const normalized = withoutExtension
    .toLowerCase()
    .replaceAll("ı", "i")
    .replaceAll("ş", "s")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  const base = normalized === "" ? "gorsel" : normalized;
  // Aynı adlı dosyanın öncekini sessizce ezmemesi için kısa bir sonek eklenir.
  return `${base}-${Date.now().toString(36).slice(-4)}`;
}

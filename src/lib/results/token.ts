/**
 * Puanlanmış sonucun imzalanması ve doğrulanması.
 *
 * NEDEN GEREKLİ: Sonuçlar yalnızca kullanıcı onay verirse kaydedilir. Onay, testin
 * bitiminden sonra ayrı bir istekle gelir; o istekteki sayılara güvenemeyiz, çünkü isteyen
 * herkes "IQ 145" yazıp gönderebilir ve istatistikleri bozabilir.
 *
 * ÇÖZÜM: Sunucu, testi puanladıktan sonra sonucu HMAC ile imzalar ve imzalı paketi tarayıcıya
 * verir. Kullanıcı onay verirse paket geri gönderilir; sunucu imzayı doğrulayıp içindeki
 * (kendi ürettiği) sayıları kaydeder. Böylece onay verilmeden hiçbir şey saklanmaz ve
 * saklanan veri her zaman sunucunun kendi hesabıdır.
 *
 * Paketin kısa bir ömrü vardır; eski bir paket tekrar tekrar gönderilip aynı sonuç
 * defalarca kaydedilemesin diye.
 *
 * Kullanım: /api/test/submit imzalar, /api/results doğrular.
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { StoredQuestionResult, StoredResultSummary } from "./schema";

/** İmzalı paketin içeriği: sunucunun hesapladığı sonuç + üretim zamanı. */
export interface SignedResultPayload extends StoredResultSummary {
  /** Paketin kimliği; aynı paket iki kez kaydedilmeye çalışılırsa ayırt etmek için. */
  resultId: string;
  issuedAtMs: number;
  questions: StoredQuestionResult[];
}

/** Paketin geçerlilik süresi: 2 saat. Test bitiminden sonra onay için fazlasıyla yeterli. */
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * İmzalama anahtarı.
 *
 * Production'da `RESULT_SIGNING_SECRET` tanımlı olmalıdır. Tanımlı değilse süreç başına
 * rastgele bir anahtar üretilir: geliştirme sırasında her şey çalışır, ancak sunucu yeniden
 * başladığında eski paketler geçersiz olur (istenen davranış budur, sessizce zayıf bir
 * sabit anahtara düşmekten iyidir).
 */
const SIGNING_SECRET = process.env.RESULT_SIGNING_SECRET ?? randomUUID();

function sign(data: string): string {
  return createHmac("sha256", SIGNING_SECRET).update(data).digest("base64url");
}

/** Sonucu imzalar ve "gövde.imza" biçiminde tek bir metin döner. */
export function createResultToken(
  summary: StoredResultSummary,
  questions: StoredQuestionResult[],
): string {
  const payload: SignedResultPayload = {
    ...summary,
    resultId: randomUUID(),
    issuedAtMs: Date.now(),
    questions,
  };

  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export type TokenVerification =
  | { ok: true; payload: SignedResultPayload }
  | { ok: false; error: string };

/** İmzayı ve süreyi doğrular; geçerliyse sunucunun ürettiği sonucu döner. */
export function verifyResultToken(token: string): TokenVerification {
  const separator = token.lastIndexOf(".");
  if (separator === -1) {
    return { ok: false, error: "Sonuç paketi bozuk." };
  }

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  const expected = Buffer.from(sign(body));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return { ok: false, error: "Sonuç paketi doğrulanamadı." };
  }

  let payload: SignedResultPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SignedResultPayload;
  } catch {
    return { ok: false, error: "Sonuç paketi okunamadı." };
  }

  if (Date.now() - payload.issuedAtMs > TOKEN_TTL_MS) {
    return { ok: false, error: "Sonuç paketinin süresi dolmuş. Testi yeniden çözebilirsiniz." };
  }

  return { ok: true, payload };
}

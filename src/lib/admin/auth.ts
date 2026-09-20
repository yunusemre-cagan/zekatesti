/**
 * Admin paneli kimlik doğrulaması.
 *
 * Panel tek kişiliktir ve yalnızca soru verisini yönetir; bu yüzden kullanıcı veritabanı
 * yerine ortam değişkenindeki tek bir şifre (`ADMIN_PASSWORD`) kullanılır.
 *
 * Nasıl çalışır: Şifre doğruysa, şifreden türetilen bir imza (HMAC) httpOnly çerezde saklanır.
 * Çerezde şifrenin kendisi bulunmaz ve imza sunucudaki şifre değişince geçersiz olur.
 * Karşılaştırmalar `timingSafeEqual` ile yapılır (zamanlama saldırılarına karşı).
 *
 * Kullanım: Admin sayfaları ve /api/admin/* route'ları, istek sahibini doğrulamak için çağırır.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "admin_session";

/** Oturum süresi: 12 saat. Panelde uzun süre işlem yapılmazsa yeniden giriş gerekir. */
const SESSION_MAX_AGE_SEC = 12 * 60 * 60;

/** Yapılandırılmış admin şifresi; tanımlı değilse panel tamamen kapalıdır. */
function getConfiguredPassword(): string | undefined {
  const password = process.env.ADMIN_PASSWORD;
  return password === undefined || password === "" ? undefined : password;
}

/** ADMIN_PASSWORD tanımlı mı? Tanımlı değilse giriş ekranı bunu açıklar. */
export function isAdminConfigured(): boolean {
  return getConfiguredPassword() !== undefined;
}

/** Şifreden oturum imzası üretir. Şifre değişirse eski imzalar geçersiz olur. */
function createSessionToken(password: string): string {
  return createHmac("sha256", password).update("admin-session-v1").digest("hex");
}

/** İki metni, uzunluk bilgisi sızdırmadan sabit sürede karşılaştırır. */
function safeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Girilen şifreyi doğrular ve doğruysa oturum çerezini yazar.
 * @returns Giriş başarılıysa `true`.
 */
export async function signIn(password: string): Promise<boolean> {
  const configured = getConfiguredPassword();
  if (configured === undefined || !safeEquals(password, configured)) {
    return false;
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, createSessionToken(configured), {
    httpOnly: true,
    sameSite: "lax",
    // Yerelde HTTP kullanıldığı için `secure` yalnızca production'da açılır.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
  return true;
}

/** Oturumu kapatır. */
export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}

/** İsteğin geçerli bir admin oturumu taşıyıp taşımadığını döner. */
export async function isAuthenticated(): Promise<boolean> {
  const configured = getConfiguredPassword();
  if (configured === undefined) return false;

  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (token === undefined) return false;

  return safeEquals(token, createSessionToken(configured));
}

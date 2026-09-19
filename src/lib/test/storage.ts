/**
 * Test ilerlemesinin ve sonucunun tarayıcıda (sessionStorage) saklanması.
 *
 * İki amacı vardır:
 *  1. Sayfa yenilenirse test baştan başlamasın (ilerleme).
 *  2. Sonuç ekranı, puanlanmış sonucu okuyabilsin (sonuç sunucudan bir kez gelir).
 *
 * sessionStorage gizli sekmede veya site verisi engellendiğinde hata fırlatabildiği için
 * tüm okuma/yazmalar try/catch ile sarılır: saklama çalışmazsa test yine de çözülebilir.
 * Okunan veri güvenilmez kabul edilip Zod ile doğrulanır (bozuk/eski veri yok sayılır).
 *
 * Kullanım: use-test-session.ts (ilerleme) ve sonuç ekranı (sonuç) tarafından çağrılır.
 */
import { z } from "zod";
import type { TestResult } from "@/lib/scoring/score-test";
import { answerSchema } from "./answers";
import type { RestorableProgress } from "./session";

const PROGRESS_KEY = "iq-test-progress";
const RESULT_KEY = "iq-test-result";

/**
 * Saklanan verinin sürümü. Şema değişirse artırılır; eski kayıtlar sessizce yok sayılır,
 * böylece güncelleme sonrası kullanıcı bozuk bir oturumla karşılaşmaz.
 */
const STORAGE_VERSION = 1;

const progressSchema = z.object({
  version: z.literal(STORAGE_VERSION),
  index: z.int().min(0),
  answers: z.record(z.string(), answerSchema),
  taskStartedAt: z.record(z.string(), z.number()),
  completedTasks: z.record(z.string(), z.literal(true)),
  startedAtMs: z.number(),
});

export function saveProgress(progress: RestorableProgress): void {
  writeJson(PROGRESS_KEY, { version: STORAGE_VERSION, ...progress });
}

export function loadProgress(): RestorableProgress | undefined {
  const parsed = progressSchema.safeParse(readJson(PROGRESS_KEY));
  if (!parsed.success) return undefined;
  // Sürüm bilgisi yalnızca doğrulama içindir; oturum durumuna taşınmaz.
  return {
    index: parsed.data.index,
    answers: parsed.data.answers,
    taskStartedAt: parsed.data.taskStartedAt,
    completedTasks: parsed.data.completedTasks,
    startedAtMs: parsed.data.startedAtMs,
  };
}

export function clearProgress(): void {
  removeKey(PROGRESS_KEY);
}

/**
 * Sonuç, doğrulanmadan saklanır ve okunur: içeriği kullanıcıdan değil sunucudan gelir ve
 * yalnızca gösterim amaçlıdır. Kurcalanması durumunda etkilenen tek şey kullanıcının
 * kendi ekranıdır; puanlama sunucuda yapılmıştır.
 */
export function saveResult(result: TestResult): void {
  writeJson(RESULT_KEY, result);
}

export function clearResult(): void {
  removeKey(RESULT_KEY);
}

/**
 * Saklanan sonucu ham metin olarak döner (yoksa `null`).
 *
 * Sonuç ekranı bu değeri `useSyncExternalStore` ile okur; bu yüzden dönüş değeri her çağrıda
 * yeni bir nesne değil, değişmediği sürece aynı kalan bir metin olmalıdır. Metnin nesneye
 * çevrilmesi çağıran tarafta yapılır.
 */
export function readRawResult(): string | null {
  try {
    return sessionStorage.getItem(RESULT_KEY);
  } catch {
    return null;
  }
}

/**
 * `useSyncExternalStore` için abonelik. sessionStorage aynı sekmede olay yayınlamadığı için
 * dinlenecek bir kaynak yoktur; sonuç sayfa açıkken değişmez. Yine de API'nin gerektirdiği
 * abonelik fonksiyonu sağlanır.
 */
export function subscribeToResult(): () => void {
  return () => undefined;
}

// ---------------------------------------------------------------------------
// sessionStorage sarmalayıcıları (hata fırlatmazlar)
// ---------------------------------------------------------------------------

function writeJson(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Saklama kullanılamıyor (gizli sekme, kapalı site verisi, kota). Test devam edebilir.
  }
}

function readJson(key: string): unknown {
  try {
    const raw = sessionStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function removeKey(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Yok sayılır.
  }
}

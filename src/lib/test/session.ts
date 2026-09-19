/**
 * Test oturumunun durum yönetimi (reducer).
 *
 * Testin tüm "iş mantığı" burada, React'ten bağımsız saf fonksiyonlar olarak durur:
 * hangi soruda olunduğu, verilen cevaplar, bir kez oynatılan soruların (bellek/hız)
 * durumu ve testin bitip bitmediği. Bileşenler yalnızca `dispatch` çağırır ve durumu gösterir.
 *
 * Kullanım: use-test-session.ts hook'u bu reducer'ı `useReducer` ile çalıştırır;
 * session.test.ts ise doğrudan test eder.
 */
import type { PublicQuestion } from "@/lib/questions/sanitize";
import type { Answer, AnswerMap } from "./answers";

/**
 * - loading    : Sorular sunucudan alınıyor
 * - ready      : Test çözülüyor
 * - submitting : Cevaplar gönderiliyor
 * - error      : Sorular alınamadı veya gönderim başarısız oldu
 */
export type TestStatus = "loading" | "ready" | "submitting" | "error";

export interface TestSessionState {
  status: TestStatus;
  /** Testin toplam süresi (saniye); sunucudan gelir. */
  durationSec: number;
  questions: PublicQuestion[];
  /** Ekranda gösterilen sorunun sırası (0 tabanlı). */
  index: number;
  answers: AnswerMap;
  /**
   * Bellek ve hız sorularının başlatılma anı (ms, epoch). Sayfa yenilense bile görev
   * baştan başlamaz; kalan süre bu değerden hesaplanır.
   */
  taskStartedAt: Record<string, number>;
  /** Bir kez oynatılıp tamamlanmış (tekrar başlatılamayan) sorular. */
  completedTasks: Record<string, true>;
  /** Testin başlangıç anı (ms, epoch). Kalan süre bundan hesaplanır. */
  startedAtMs: number;
  /** Kullanıcıya gösterilecek hata mesajı (status === "error" iken). */
  errorMessage?: string;
}

export type TestSessionAction =
  | { type: "loaded"; questions: PublicQuestion[]; durationSec: number; startedAtMs: number }
  | { type: "answer"; questionId: string; answer: Answer }
  | { type: "goto"; index: number }
  | { type: "next" }
  | { type: "prev" }
  | { type: "startTask"; questionId: string; startedAtMs: number }
  | { type: "completeTask"; questionId: string }
  | { type: "submitting" }
  | { type: "error"; message: string }
  | { type: "restoreProgress"; progress: RestorableProgress };

/** Sayfa yenilendiğinde geri yüklenen ilerleme (bkz. storage.ts). */
export interface RestorableProgress {
  index: number;
  answers: AnswerMap;
  taskStartedAt: Record<string, number>;
  completedTasks: Record<string, true>;
  startedAtMs: number;
}

export const initialTestSessionState: TestSessionState = {
  status: "loading",
  durationSec: 0,
  questions: [],
  index: 0,
  answers: {},
  taskStartedAt: {},
  completedTasks: {},
  startedAtMs: 0,
};

export function testSessionReducer(
  state: TestSessionState,
  action: TestSessionAction,
): TestSessionState {
  switch (action.type) {
    case "loaded":
      return {
        ...state,
        status: "ready",
        questions: action.questions,
        durationSec: action.durationSec,
        startedAtMs: action.startedAtMs,
      };

    case "answer":
      return { ...state, answers: { ...state.answers, [action.questionId]: action.answer } };

    case "goto":
      return { ...state, index: clampIndex(action.index, state.questions.length) };

    case "next":
      return { ...state, index: clampIndex(state.index + 1, state.questions.length) };

    case "prev":
      return { ...state, index: clampIndex(state.index - 1, state.questions.length) };

    case "startTask":
      // Bir görev yalnızca bir kez başlatılabilir; tekrar tıklamalar süreyi sıfırlamaz.
      if (state.taskStartedAt[action.questionId] !== undefined) return state;
      return {
        ...state,
        taskStartedAt: { ...state.taskStartedAt, [action.questionId]: action.startedAtMs },
      };

    case "completeTask":
      return {
        ...state,
        completedTasks: { ...state.completedTasks, [action.questionId]: true },
      };

    case "submitting":
      return { ...state, status: "submitting" };

    case "error":
      return { ...state, status: "error", errorMessage: action.message };

    case "restoreProgress":
      return {
        ...state,
        index: clampIndex(action.progress.index, state.questions.length),
        answers: action.progress.answers,
        taskStartedAt: action.progress.taskStartedAt,
        completedTasks: action.progress.completedTasks,
        startedAtMs: action.progress.startedAtMs,
      };
  }
}

// ---------------------------------------------------------------------------
// Seçiciler (selectors): durumdan türetilen, ekranda gösterilecek bilgiler
// ---------------------------------------------------------------------------

/** Ekranda gösterilen soru; sorular henüz yüklenmediyse `undefined`. */
export function getCurrentQuestion(state: TestSessionState): PublicQuestion | undefined {
  return state.questions[state.index];
}

/** Cevaplanmış soru sayısı (hız görevinde en az bir madde işaretlenmişse cevaplanmış sayılır). */
export function getAnsweredCount(state: TestSessionState): number {
  return state.questions.filter((question) => isAnswered(state.answers[question.id])).length;
}

/** Bir cevabın "boş" sayılıp sayılmayacağını belirler. */
export function isAnswered(answer: Answer | undefined): boolean {
  if (answer === undefined) return false;
  switch (answer.type) {
    case "single_choice":
      return answer.optionId !== "";
    case "multi_choice":
      return answer.optionIds.length > 0;
    case "memory_sequence":
      return answer.value.trim() !== "";
    case "speed_task":
      return Object.keys(answer.responses).length > 0;
  }
}

/** İlerleme çubuğu için 0–100 arası yüzde. */
export function getProgressPercent(state: TestSessionState): number {
  if (state.questions.length === 0) return 0;
  return Math.round((getAnsweredCount(state) / state.questions.length) * 100);
}

/** Sayfa yenilendiğinde geri yüklenecek ilerleme verisini durumdan çıkarır. */
export function toRestorableProgress(state: TestSessionState): RestorableProgress {
  return {
    index: state.index,
    answers: state.answers,
    taskStartedAt: state.taskStartedAt,
    completedTasks: state.completedTasks,
    startedAtMs: state.startedAtMs,
  };
}

function clampIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}

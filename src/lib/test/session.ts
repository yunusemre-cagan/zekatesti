/**
 * Test oturumunun durum yönetimi (reducer).
 *
 * Testin tüm "iş mantığı" burada, React'ten bağımsız saf fonksiyonlar olarak durur:
 * hangi soruda olunduğu, verilen cevaplar, soru bazında harcanan süre, bir kez oynatılan
 * soruların (bellek/hız) durumu. Bileşenler yalnızca `dispatch` çağırır ve durumu gösterir.
 *
 * SÜRE ÖLÇÜMÜ: Her sorunun süresi ayrı tutulur. Ekrandaki soru değiştiğinde (veya test
 * gönderildiğinde) o ana kadar geçen süre, o sorunun toplamına eklenir. Süre kaydı soru
 * başına üst sınırla kırpılır. Zamanın kaynağı reducer'a dışarıdan verilir (`nowMs`);
 * böylece reducer saf kalır ve test edilebilir.
 *
 * Kullanım: use-test-session.ts hook'u bu reducer'ı `useReducer` ile çalıştırır;
 * session.test.ts ise doğrudan test eder.
 */
import { capRecordedSec } from "@/lib/scoring/speed-factor";
import type { PublicQuestion } from "@/lib/questions/sanitize";
import type { Answer, AnswerMap, DurationMap } from "./answers";

/**
 * - loading    : Sorular sunucudan alınıyor
 * - ready      : Test çözülüyor
 * - submitting : Cevaplar gönderiliyor
 * - error      : Sorular alınamadı veya gönderim başarısız oldu
 */
export type TestStatus = "loading" | "ready" | "submitting" | "error";

export interface TestSessionState {
  status: TestStatus;
  /** Testin görünmeyen emniyet sınırı (saniye); sunucudan gelir. */
  safetyLimitSec: number;
  questions: PublicQuestion[];
  /** Ekranda gösterilen sorunun sırası (0 tabanlı). */
  index: number;
  answers: AnswerMap;
  /** Soru kimliği → o soruda şimdiye kadar harcanan toplam süre (saniye). */
  durations: DurationMap;
  /** Ekrandaki sorunun sayacının başladığı an (ms, epoch). */
  questionEnteredAtMs: number;
  /**
   * Bellek ve hız sorularının başlatılma anı (ms, epoch). Sayfa yenilense bile görev
   * baştan başlamaz; kalan süre bu değerden hesaplanır.
   */
  taskStartedAt: Record<string, number>;
  /** Bir kez oynatılıp tamamlanmış (tekrar başlatılamayan) sorular. */
  completedTasks: Record<string, true>;
  /** Testin başlangıç anı (ms, epoch). Emniyet sınırı bundan hesaplanır. */
  startedAtMs: number;
  /** Kullanıcıya gösterilecek hata mesajı (status === "error" iken). */
  errorMessage?: string;
}

export type TestSessionAction =
  | { type: "loaded"; questions: PublicQuestion[]; safetyLimitSec: number; nowMs: number }
  | { type: "answer"; questionId: string; answer: Answer }
  | { type: "goto"; index: number; nowMs: number }
  | { type: "next"; nowMs: number }
  | { type: "prev"; nowMs: number }
  | { type: "startTask"; questionId: string; nowMs: number }
  | { type: "completeTask"; questionId: string; nowMs: number }
  | { type: "submitting"; nowMs: number }
  | { type: "error"; message: string }
  | { type: "restoreProgress"; progress: RestorableProgress; nowMs: number };

/** Sayfa yenilendiğinde geri yüklenen ilerleme (bkz. storage.ts). */
export interface RestorableProgress {
  index: number;
  answers: AnswerMap;
  durations: DurationMap;
  taskStartedAt: Record<string, number>;
  completedTasks: Record<string, true>;
  startedAtMs: number;
}

export const initialTestSessionState: TestSessionState = {
  status: "loading",
  safetyLimitSec: 0,
  questions: [],
  index: 0,
  answers: {},
  durations: {},
  questionEnteredAtMs: 0,
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
        safetyLimitSec: action.safetyLimitSec,
        startedAtMs: action.nowMs,
        questionEnteredAtMs: action.nowMs,
      };

    case "answer":
      return { ...state, answers: { ...state.answers, [action.questionId]: action.answer } };

    case "goto":
      return moveTo(state, action.index, action.nowMs);

    case "next":
      return moveTo(state, state.index + 1, action.nowMs);

    case "prev":
      return moveTo(state, state.index - 1, action.nowMs);

    case "startTask": {
      // Bir görev yalnızca bir kez başlatılabilir; tekrar tıklamalar süreyi sıfırlamaz.
      if (state.taskStartedAt[action.questionId] !== undefined) return state;
      // Görev başlamadan önce okuma/hazırlık için geçen süre soruya yazılır.
      return {
        ...commitElapsed(state, action.nowMs),
        taskStartedAt: { ...state.taskStartedAt, [action.questionId]: action.nowMs },
      };
    }

    case "completeTask":
      // Görev süresi (dizinin gösterildiği veya hız görevinin sürdüğü zaman) soruya
      // yazılmaz: sayaç, kullanıcı cevap vermeye başladığı andan itibaren işler.
      return {
        ...state,
        completedTasks: { ...state.completedTasks, [action.questionId]: true },
        questionEnteredAtMs: action.nowMs,
      };

    case "submitting":
      return { ...commitElapsed(state, action.nowMs), status: "submitting" };

    case "error":
      return { ...state, status: "error", errorMessage: action.message };

    case "restoreProgress":
      return {
        ...state,
        index: clampIndex(action.progress.index, state.questions.length),
        answers: action.progress.answers,
        durations: action.progress.durations,
        taskStartedAt: action.progress.taskStartedAt,
        completedTasks: action.progress.completedTasks,
        startedAtMs: action.progress.startedAtMs,
        // Geri yüklemeden sonra sayaç yeniden başlar; sayfanın kapalı olduğu süre sayılmaz.
        questionEnteredAtMs: action.nowMs,
      };
  }
}

// ---------------------------------------------------------------------------
// Süre yardımcıları
// ---------------------------------------------------------------------------

/**
 * Ekrandaki soruda geçen süreyi o sorunun toplamına ekler ve sayacı sıfırlar.
 * Soru listesi henüz yüklenmemişse bir şey yapmaz.
 */
function commitElapsed(state: TestSessionState, nowMs: number): TestSessionState {
  const question = state.questions[state.index];
  if (question === undefined || state.questionEnteredAtMs === 0) {
    return { ...state, questionEnteredAtMs: nowMs };
  }

  const elapsedSec = Math.max(0, (nowMs - state.questionEnteredAtMs) / 1000);
  const previous = state.durations[question.id] ?? 0;

  return {
    ...state,
    durations: { ...state.durations, [question.id]: capRecordedSec(previous + elapsedSec) },
    questionEnteredAtMs: nowMs,
  };
}

/** Süreyi kaydedip başka bir soruya geçer. */
function moveTo(state: TestSessionState, index: number, nowMs: number): TestSessionState {
  const nextIndex = clampIndex(index, state.questions.length);
  if (nextIndex === state.index) return state;
  return { ...commitElapsed(state, nowMs), index: nextIndex };
}

/**
 * Gönderime hazır süre kayıtlarını üretir: kaydedilmiş süreler + ekrandaki soruda
 * şu an işleyen süre.
 */
export function getSubmittableDurations(state: TestSessionState, nowMs: number): DurationMap {
  return commitElapsed(state, nowMs).durations;
}

/** Ekrandaki soruda şu ana kadar geçen süre (saniye) — sayaç gösterimi için. */
export function getCurrentQuestionSeconds(state: TestSessionState, nowMs: number): number {
  const question = state.questions[state.index];
  if (question === undefined) return 0;
  const recorded = state.durations[question.id] ?? 0;
  const running = state.questionEnteredAtMs === 0 ? 0 : (nowMs - state.questionEnteredAtMs) / 1000;
  return Math.floor(capRecordedSec(recorded + Math.max(0, running)));
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
    case "open_answer":
      return answer.value.trim() !== "";
    case "memory_sequence":
      return answer.value.trim() !== "";
    case "nback_task":
      // n-back görevinde hiç işaret koymamak da geçerli bir cevaptır; görev tamamlandıysa
      // cevaplanmış sayılır. Tamamlanma bilgisi completedTasks içinde tutulur.
      return true;
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
    durations: state.durations,
    taskStartedAt: state.taskStartedAt,
    completedTasks: state.completedTasks,
    startedAtMs: state.startedAtMs,
  };
}

function clampIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}

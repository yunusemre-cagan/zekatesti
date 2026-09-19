import { describe, expect, it } from "vitest";
import { toPublicQuestion } from "@/lib/questions/sanitize";
import { makeMemory, makeSingleChoice, makeSpeedTask } from "@/lib/testing/fixtures";
import { QUESTION_TIME } from "@/lib/config";
import {
  getAnsweredCount,
  getCurrentQuestion,
  getCurrentQuestionSeconds,
  getProgressPercent,
  getSubmittableDurations,
  initialTestSessionState,
  isAnswered,
  testSessionReducer,
  toRestorableProgress,
  type TestSessionState,
} from "./session";

const questions = [
  toPublicQuestion(makeSingleChoice({ id: "q-1" })),
  toPublicQuestion(makeMemory({ id: "q-2" })),
  toPublicQuestion(makeSpeedTask({ id: "q-3" })),
];

/** Soruları yüklenmiş, çözülmeye hazır bir oturum durumu üretir. */
function loadedState(overrides: Partial<TestSessionState> = {}): TestSessionState {
  const base = testSessionReducer(initialTestSessionState, {
    type: "loaded",
    questions,
    safetyLimitSec: 2700,
    nowMs: 1_000,
  });
  return { ...base, ...overrides };
}

describe("testSessionReducer", () => {
  it("sorular yüklendiğinde durumu hazıra çeker", () => {
    const state = loadedState();
    expect(state.status).toBe("ready");
    expect(state.questions).toHaveLength(3);
    expect(state.safetyLimitSec).toBe(2700);
  });

  it("cevabı kaydeder ve öncekini değiştirir", () => {
    let state = loadedState();
    state = testSessionReducer(state, {
      type: "answer",
      questionId: "q-1",
      answer: { type: "single_choice", optionId: "a" },
    });
    state = testSessionReducer(state, {
      type: "answer",
      questionId: "q-1",
      answer: { type: "single_choice", optionId: "b" },
    });
    expect(state.answers["q-1"]).toEqual({ type: "single_choice", optionId: "b" });
  });

  it("soru sırasını sınırlar (ilk sorudan öncesine, son sorudan sonrasına gitmez)", () => {
    let state = loadedState();
    state = testSessionReducer(state, { type: "prev", nowMs: 2_000 });
    expect(state.index).toBe(0);

    state = testSessionReducer(state, { type: "goto", index: 99, nowMs: 3_000 });
    expect(state.index).toBe(2);

    state = testSessionReducer(state, { type: "next", nowMs: 4_000 });
    expect(state.index).toBe(2);
  });

  it("başlatılmış bir görevi yeniden başlatmaz (süre sıfırlanamaz)", () => {
    let state = loadedState();
    state = testSessionReducer(state, { type: "startTask", questionId: "q-3", nowMs: 5_000 });
    state = testSessionReducer(state, { type: "startTask", questionId: "q-3", nowMs: 9_999 });
    expect(state.taskStartedAt["q-3"]).toBe(5_000);
  });

  it("tamamlanan görevi işaretler", () => {
    const state = testSessionReducer(loadedState(), { type: "completeTask", questionId: "q-2", nowMs: 6_000 });
    expect(state.completedTasks["q-2"]).toBe(true);
  });

  it("kaydedilmiş ilerlemeyi geri yükler ve sıra numarasını soru sayısına göre sınırlar", () => {
    const state = testSessionReducer(loadedState(), {
      type: "restoreProgress",
      progress: {
        index: 50,
        answers: { "q-1": { type: "single_choice", optionId: "a" } },
        durations: { "q-1": 12 },
        taskStartedAt: { "q-3": 42 },
        completedTasks: { "q-2": true },
        startedAtMs: 123,
      },
      nowMs: 7_000,
    });

    expect(state.index).toBe(2);
    expect(state.answers["q-1"]).toEqual({ type: "single_choice", optionId: "a" });
    expect(state.startedAtMs).toBe(123);
  });

  it("hata durumunda mesajı saklar", () => {
    const state = testSessionReducer(loadedState(), { type: "error", message: "Bağlantı yok" });
    expect(state).toMatchObject({ status: "error", errorMessage: "Bağlantı yok" });
  });
});

describe("soru bazlı süre ölçümü", () => {
  const SECOND = 1_000;

  it("soru değiştirildiğinde geçen süreyi o soruya yazar", () => {
    let state = loadedState(); // yükleme anı: 1_000 ms
    state = testSessionReducer(state, { type: "next", nowMs: 1_000 + 30 * SECOND });

    expect(state.durations["q-1"]).toBeCloseTo(30);
    expect(state.durations["q-2"]).toBeUndefined();
  });

  it("aynı soruya geri dönüldüğünde süreleri toplar", () => {
    let state = loadedState();
    state = testSessionReducer(state, { type: "next", nowMs: 1_000 + 10 * SECOND }); // q-1: 10 sn
    state = testSessionReducer(state, { type: "prev", nowMs: 1_000 + 25 * SECOND }); // q-2: 15 sn
    state = testSessionReducer(state, { type: "next", nowMs: 1_000 + 30 * SECOND }); // q-1: +5 sn

    expect(state.durations["q-1"]).toBeCloseTo(15);
    expect(state.durations["q-2"]).toBeCloseTo(15);
  });

  it("bir soruda kaydedilen süreyi üst sınırda keser", () => {
    let state = loadedState();
    state = testSessionReducer(state, { type: "next", nowMs: 1_000 + 3 * 60 * 60 * SECOND });
    expect(state.durations["q-1"]).toBe(QUESTION_TIME.MAX_RECORDED_SEC);
  });

  it("görev süresini (dizi gösterimi / hız görevi) soruya yazmaz", () => {
    // 2. soru (bellek) gösterilirken görev başlatılıp 40 saniye sonra tamamlanıyor.
    let state = loadedState({ index: 1, questionEnteredAtMs: 1_000 });
    state = testSessionReducer(state, {
      type: "startTask",
      questionId: "q-2",
      nowMs: 1_000 + 5 * SECOND, // soruyu okumak için geçen 5 saniye kaydedilir
    });
    state = testSessionReducer(state, {
      type: "completeTask",
      questionId: "q-2",
      nowMs: 1_000 + 45 * SECOND, // gösterimde geçen 40 saniye kaydedilmez
    });
    state = testSessionReducer(state, { type: "prev", nowMs: 1_000 + 55 * SECOND });

    expect(state.durations["q-2"]).toBeCloseTo(15); // 5 sn okuma + 10 sn cevaplama
  });

  it("gönderimde, ekrandaki soruda işleyen süreyi de kayda ekler", () => {
    const state = loadedState();
    const durations = getSubmittableDurations(state, 1_000 + 12 * SECOND);
    expect(durations["q-1"]).toBeCloseTo(12);
  });

  it("gönderim için süre çıkarmak durumu değiştirmez", () => {
    const state = loadedState();
    getSubmittableDurations(state, 1_000 + 12 * SECOND);
    expect(state.durations).toEqual({});
  });

  it("sayfa kapalıyken geçen süreyi saymaz", () => {
    let state = loadedState();
    // Kullanıcı 1 saat sonra geri dönüyor; geri yükleme sayacı yeniden başlatır.
    state = testSessionReducer(state, {
      type: "restoreProgress",
      progress: {
        index: 0,
        answers: {},
        durations: { "q-1": 20 },
        taskStartedAt: {},
        completedTasks: {},
        startedAtMs: 1_000,
      },
      nowMs: 3_600_000,
    });
    state = testSessionReducer(state, { type: "next", nowMs: 3_600_000 + 5 * SECOND });

    expect(state.durations["q-1"]).toBeCloseTo(25); // 20 sn kayıt + 5 sn yeni
  });

  it("ekrandaki sorunun anlık süresini kayıtla birlikte gösterir", () => {
    const state = loadedState({ durations: { "q-1": 8 } });
    expect(getCurrentQuestionSeconds(state, 1_000 + 4 * SECOND)).toBe(12);
  });
});

describe("seçiciler", () => {
  it("geçerli soruyu döner", () => {
    expect(getCurrentQuestion(loadedState({ index: 1 }))?.id).toBe("q-2");
  });

  it("boş cevapları cevaplanmış saymaz", () => {
    expect(isAnswered(undefined)).toBe(false);
    expect(isAnswered({ type: "single_choice", optionId: "" })).toBe(false);
    expect(isAnswered({ type: "multi_choice", optionIds: [] })).toBe(false);
    expect(isAnswered({ type: "memory_sequence", value: "   " })).toBe(false);
    expect(isAnswered({ type: "speed_task", responses: {} })).toBe(false);
  });

  it("dolu cevapları cevaplanmış sayar", () => {
    expect(isAnswered({ type: "single_choice", optionId: "a" })).toBe(true);
    expect(isAnswered({ type: "multi_choice", optionIds: ["a"] })).toBe(true);
    expect(isAnswered({ type: "memory_sequence", value: "814" })).toBe(true);
    expect(isAnswered({ type: "speed_task", responses: { i1: "1" } })).toBe(true);
  });

  it("cevaplanan soru sayısını ve ilerleme yüzdesini hesaplar", () => {
    const state = loadedState({
      answers: {
        "q-1": { type: "single_choice", optionId: "a" },
        "q-2": { type: "memory_sequence", value: "" },
      },
    });
    expect(getAnsweredCount(state)).toBe(1);
    expect(getProgressPercent(state)).toBe(33);
  });

  it("soru yokken ilerleme yüzdesi 0'dır", () => {
    expect(getProgressPercent(initialTestSessionState)).toBe(0);
  });

  it("saklanacak ilerleme verisini çıkarır", () => {
    const state = loadedState({ index: 1 });
    expect(toRestorableProgress(state)).toEqual({
      index: 1,
      answers: {},
      durations: {},
      taskStartedAt: {},
      completedTasks: {},
      startedAtMs: 1_000,
    });
  });
});

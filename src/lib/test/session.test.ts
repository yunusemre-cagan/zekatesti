import { describe, expect, it } from "vitest";
import { toPublicQuestion } from "@/lib/questions/sanitize";
import { makeMemory, makeSingleChoice, makeSpeedTask } from "@/lib/testing/fixtures";
import {
  getAnsweredCount,
  getCurrentQuestion,
  getProgressPercent,
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
    durationSec: 1800,
    startedAtMs: 1_000,
  });
  return { ...base, ...overrides };
}

describe("testSessionReducer", () => {
  it("sorular yüklendiğinde durumu hazıra çeker", () => {
    const state = loadedState();
    expect(state.status).toBe("ready");
    expect(state.questions).toHaveLength(3);
    expect(state.durationSec).toBe(1800);
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
    state = testSessionReducer(state, { type: "prev" });
    expect(state.index).toBe(0);

    state = testSessionReducer(state, { type: "goto", index: 99 });
    expect(state.index).toBe(2);

    state = testSessionReducer(state, { type: "next" });
    expect(state.index).toBe(2);
  });

  it("başlatılmış bir görevi yeniden başlatmaz (süre sıfırlanamaz)", () => {
    let state = loadedState();
    state = testSessionReducer(state, { type: "startTask", questionId: "q-3", startedAtMs: 5_000 });
    state = testSessionReducer(state, { type: "startTask", questionId: "q-3", startedAtMs: 9_999 });
    expect(state.taskStartedAt["q-3"]).toBe(5_000);
  });

  it("tamamlanan görevi işaretler", () => {
    const state = testSessionReducer(loadedState(), { type: "completeTask", questionId: "q-2" });
    expect(state.completedTasks["q-2"]).toBe(true);
  });

  it("kaydedilmiş ilerlemeyi geri yükler ve sıra numarasını soru sayısına göre sınırlar", () => {
    const state = testSessionReducer(loadedState(), {
      type: "restoreProgress",
      progress: {
        index: 50,
        answers: { "q-1": { type: "single_choice", optionId: "a" } },
        taskStartedAt: { "q-3": 42 },
        completedTasks: { "q-2": true },
        startedAtMs: 123,
      },
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
      taskStartedAt: {},
      completedTasks: {},
      startedAtMs: 1_000,
    });
  });
});

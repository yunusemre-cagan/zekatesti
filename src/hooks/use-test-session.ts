"use client";

/**
 * Test oturumunu yürüten hook: soruları yükler, durumu tutar, ilerlemeyi saklar ve
 * cevapları sunucuya gönderir.
 *
 * İş mantığının kendisi burada değil, saf modüllerdedir (lib/test/session.ts, storage.ts).
 * Bu hook yalnızca onları React yaşam döngüsüne bağlar: veri çekme, kaydetme, yönlendirme.
 *
 * Kullanım: TestRunner bileşeni.
 */
import { useCallback, useEffect, useMemo, useReducer } from "react";
import { useRouter } from "next/navigation";
import type { ApiErrorResponse, TestStartResponse, TestSubmitResponse } from "@/lib/api/contracts";
import type { Answer } from "@/lib/test/answers";
import {
  getAnsweredCount,
  getCurrentQuestion,
  getProgressPercent,
  initialTestSessionState,
  testSessionReducer,
  toRestorableProgress,
  type TestSessionState,
} from "@/lib/test/session";
import { clearProgress, loadProgress, saveProgress, saveResult } from "@/lib/test/storage";
import { getElapsedSec } from "@/lib/test/time";

export interface TestSessionController {
  state: TestSessionState;
  currentQuestion: ReturnType<typeof getCurrentQuestion>;
  answeredCount: number;
  progressPercent: number;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  answer: (questionId: string, answer: Answer) => void;
  goTo: (index: number) => void;
  next: () => void;
  prev: () => void;
  startTask: (questionId: string) => void;
  completeTask: (questionId: string) => void;
  submit: () => void;
}

export function useTestSession(): TestSessionController {
  const router = useRouter();
  const [state, dispatch] = useReducer(testSessionReducer, initialTestSessionState);

  // 1) Soruları yükle ve varsa önceki ilerlemeyi geri yükle.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/test/start");
        if (!response.ok) throw new Error(`Sunucu ${response.status} döndü.`);
        const data = (await response.json()) as TestStartResponse;
        if (cancelled) return;

        const saved = loadProgress();
        dispatch({
          type: "loaded",
          questions: data.questions,
          durationSec: data.durationSec,
          startedAtMs: Date.now(),
        });
        // Kaydedilmiş ilerleme, soru listesi yüklendikten sonra uygulanır (index sınırlanabilsin diye).
        if (saved !== undefined) {
          dispatch({ type: "restoreProgress", progress: saved });
        }
      } catch (error) {
        if (cancelled) return;
        console.error("[useTestSession] sorular yüklenemedi", error);
        dispatch({ type: "error", message: "Sorular yüklenemedi. Sayfayı yenileyip tekrar deneyin." });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2) İlerlemeyi her değişiklikte sakla (sayfa yenilenirse test baştan başlamasın).
  useEffect(() => {
    if (state.status !== "ready") return;
    saveProgress(toRestorableProgress(state));
  }, [state]);

  // 3) Cevapları gönder ve sonuç ekranına geç.
  const submit = useCallback(async () => {
    dispatch({ type: "submitting" });
    try {
      const response = await fetch("/api/test/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answers: state.answers,
          elapsedSec: getElapsedSec(state.startedAtMs, Date.now()),
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => undefined)) as ApiErrorResponse | undefined;
        throw new Error(body?.error ?? `Sunucu ${response.status} döndü.`);
      }

      const result = (await response.json()) as TestSubmitResponse;
      saveResult(result);
      clearProgress();
      router.push("/result");
    } catch (error) {
      console.error("[useTestSession] cevaplar gönderilemedi", error);
      dispatch({
        type: "error",
        message: "Cevaplar gönderilemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.",
      });
    }
  }, [router, state.answers, state.startedAtMs]);

  // Bileşenin ihtiyaç duyduğu türetilmiş değerler tek seferde hesaplanır.
  const derived = useMemo(
    () => ({
      currentQuestion: getCurrentQuestion(state),
      answeredCount: getAnsweredCount(state),
      progressPercent: getProgressPercent(state),
      isFirstQuestion: state.index === 0,
      isLastQuestion: state.index === state.questions.length - 1,
    }),
    [state],
  );

  return {
    state,
    ...derived,
    answer: useCallback(
      (questionId: string, answer: Answer) => dispatch({ type: "answer", questionId, answer }),
      [],
    ),
    goTo: useCallback((index: number) => dispatch({ type: "goto", index }), []),
    next: useCallback(() => dispatch({ type: "next" }), []),
    prev: useCallback(() => dispatch({ type: "prev" }), []),
    startTask: useCallback(
      (questionId: string) => dispatch({ type: "startTask", questionId, startedAtMs: Date.now() }),
      [],
    ),
    completeTask: useCallback(
      (questionId: string) => dispatch({ type: "completeTask", questionId }),
      [],
    ),
    submit: useCallback(() => void submit(), [submit]),
  };
}

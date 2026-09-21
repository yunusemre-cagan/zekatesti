/**
 * Test ekranının ana bileşeni: yükleme/hata durumları, soru gezinmesi, toplam süre sayacı
 * ve testi bitirme akışı.
 *
 * Durum ve iş mantığı `useTestSession` hook'u (ve onun kullandığı saf modüller) içindedir;
 * bu bileşen yalnızca durumu gösterir ve kullanıcı eylemlerini hook'a iletir.
 *
 * Kullanım: /test sayfası.
 */
"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { MIN_ANSWERED_RATIO } from "@/lib/config";
import { useCountdown } from "@/hooks/use-countdown";
import { useCurrentQuestionSeconds } from "@/hooks/use-elapsed-seconds";
import { useTestSession } from "@/hooks/use-test-session";
import { QuestionRenderer } from "./QuestionRenderer";
import { TestProgress } from "./TestProgress";

export function TestRunner() {
  const session = useTestSession();
  const { state, currentQuestion } = session;
  const [isFinishConfirmOpen, setFinishConfirmOpen] = useState(false);

  // Ekrandaki soruda geçen süre (yukarı sayar); puanı etkilediği için kullanıcıya gösterilir.
  const questionSeconds = useCurrentQuestionSeconds(state);

  /**
   * Görünmeyen emniyet sınırı: test açık unutulursa, sınıra ulaşıldığında o ana kadarki
   * cevaplarla otomatik gönderilir. Kalan süre kullanıcıya gösterilmez.
   */
  const handleSafetyLimit = useCallback(() => {
    if (state.status === "ready") session.submit();
  }, [session, state.status]);

  useCountdown({
    startedAtMs: state.startedAtMs === 0 ? undefined : state.startedAtMs,
    durationSec: state.safetyLimitSec,
    onExpire: handleSafetyLimit,
  });

  if (state.status === "loading") {
    return <CenteredMessage>Sorular yükleniyor…</CenteredMessage>;
  }

  if (state.status === "error") {
    return (
      <CenteredMessage>
        <span className="text-red-600 dark:text-red-400">{state.errorMessage}</span>
        <Link href="/" className="underline">
          Başa dön
        </Link>
      </CenteredMessage>
    );
  }

  if (state.status === "submitting") {
    return <CenteredMessage>Cevaplarınız değerlendiriliyor…</CenteredMessage>;
  }

  if (currentQuestion === undefined) {
    return <CenteredMessage>Şu anda aktif soru bulunmuyor.</CenteredMessage>;
  }

  const unansweredCount = state.questions.length - session.answeredCount;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4">
      <TestProgress
        currentIndex={state.index}
        totalQuestions={state.questions.length}
        answeredCount={session.answeredCount}
        progressPercent={session.progressPercent}
        questionSeconds={questionSeconds}
      />

      <QuestionRenderer
        // key: soru değişince alt bileşenlerin iç durumu (ör. sayaç) sıfırdan kurulur.
        key={currentQuestion.id}
        question={currentQuestion}
        answer={state.answers[currentQuestion.id]}
        onAnswer={(answer) => session.answer(currentQuestion.id, answer)}
        taskStartedAtMs={state.taskStartedAt[currentQuestion.id]}
        isTaskCompleted={state.completedTasks[currentQuestion.id] === true}
        onStartTask={() => session.startTask(currentQuestion.id)}
        onCompleteTask={() => session.completeTask(currentQuestion.id)}
      />

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <button
          type="button"
          onClick={session.prev}
          disabled={session.isFirstQuestion}
          className="rounded-lg border border-zinc-300 px-4 py-2 disabled:opacity-40 dark:border-zinc-700"
        >
          Önceki
        </button>

        {session.isLastQuestion ? (
          <button
            type="button"
            onClick={() => setFinishConfirmOpen(true)}
            className="rounded-lg bg-foreground px-5 py-2 font-medium text-background"
          >
            Testi bitir
          </button>
        ) : (
          <button
            type="button"
            onClick={session.next}
            className="rounded-lg bg-foreground px-5 py-2 font-medium text-background"
          >
            Sonraki
          </button>
        )}
      </div>

      {isFinishConfirmOpen && (
        <FinishConfirm
          unansweredCount={unansweredCount}
          answeredCount={session.answeredCount}
          requiredCount={Math.ceil(state.questions.length * MIN_ANSWERED_RATIO)}
          onCancel={() => setFinishConfirmOpen(false)}
          onConfirm={session.submit}
        />
      )}
    </main>
  );
}

/**
 * Testi bitirmeden önce kullanıcıyı uyaran onay kutusu.
 *
 * Cevaplanan soru sayısı geçerlilik eşiğinin altındaysa, sonucun hesaplanamayacağı
 * bitirmeden ÖNCE söylenir; kullanıcı sonuç ekranında sürprizle karşılaşmaz.
 */
function FinishConfirm({
  unansweredCount,
  answeredCount,
  requiredCount,
  onCancel,
  onConfirm,
}: {
  unansweredCount: number;
  answeredCount: number;
  requiredCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isBelowThreshold = answeredCount < requiredCount;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl bg-background p-5">
        <h2 className="text-lg font-medium">Testi bitirmek istiyor musunuz?</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          {unansweredCount > 0
            ? `${unansweredCount} soru cevapsız kalacak ve bu sorular sıfır puan alacak.`
            : "Tüm soruları cevapladınız."}{" "}
          Bitirdikten sonra cevaplarınızı değiştiremezsiniz.
        </p>
        {isBelowThreshold && (
          <p className="rounded-lg border border-amber-300 p-3 text-sm text-amber-800 dark:border-amber-800 dark:text-amber-300">
            Şu ana kadar {answeredCount} soru cevapladınız. Tahmini IQ hesaplanabilmesi için en
            az {requiredCount} soru gerekiyor; şimdi bitirirseniz sonuç sayfasında yalnızca
            çözüm açıklamalarını görürsünüz.
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-foreground px-4 py-2 font-medium text-background"
          >
            Bitir
          </button>
        </div>
      </div>
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
      {children}
    </main>
  );
}

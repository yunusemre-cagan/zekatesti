/**
 * Çalışma belleği sorusunun arayüzü.
 *
 * Akış: "Diziyi göster" → öğeler tek tek gösterilir → dizi kaybolur → cevap alanı açılır.
 * Dizi yalnızca bir kez gösterilir; kullanıcı soruya geri dönse bile tekrar izleyemez
 * (aksi halde ölçülen şey bellek olmazdı). Bu kilit, oturum durumundaki `completedTasks`
 * ile tutulur ve sayfa yenilense de korunur.
 *
 * Kullanım: QuestionRenderer, soru tipi "memory_sequence" olduğunda bunu kullanır.
 */
"use client";

import { useSequencePlayer } from "@/hooks/use-sequence-player";
import { MEMORY_TRANSFORM_LABELS } from "@/lib/questions/labels";
import type { PublicMemorySequenceQuestion } from "@/lib/questions/sanitize";
import type { MemorySequenceAnswer } from "@/lib/test/answers";

export interface MemorySequenceViewProps {
  question: PublicMemorySequenceQuestion;
  answer: MemorySequenceAnswer | undefined;
  onAnswer: (answer: MemorySequenceAnswer) => void;
  /** Dizi gösterimi başlatıldı mı? (oturum durumundan gelir) */
  isStarted: boolean;
  /** Gösterim tamamlandı mı? Tamamlandıysa dizi bir daha oynatılmaz. */
  isCompleted: boolean;
  onStart: () => void;
  onComplete: () => void;
}

export function MemorySequenceView({
  question,
  answer,
  onAnswer,
  isStarted,
  isCompleted,
  onStart,
  onComplete,
}: MemorySequenceViewProps) {
  // Oynatma yalnızca "başlatıldı ama henüz tamamlanmadı" durumunda sürer.
  const player = useSequencePlayer(
    question.sequence,
    question.itemDisplayMs,
    isStarted && !isCompleted,
    onComplete,
  );

  if (!isStarted) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-center text-zinc-600 dark:text-zinc-400">
          {question.sequence.length} öğelik dizi tek tek gösterilecek ve bir daha
          görüntülenemeyecek. Hazır olduğunuzda başlayın.
        </p>
        <button
          type="button"
          onClick={onStart}
          className="rounded-lg bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-85"
        >
          Diziyi göster
        </button>
      </div>
    );
  }

  // Gösterim sürerken (ve ilk öğe ekrana gelmeden önceki kısa anda) cevap alanı gösterilmez;
  // aksi halde kullanıcı bir an için cevap kutusunu görür ve dizi başlamadan yazmaya çalışırdı.
  if (!isCompleted) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div
          className="flex h-32 w-32 items-center justify-center rounded-xl border border-zinc-300 text-6xl font-semibold dark:border-zinc-700"
          aria-live="polite"
        >
          {player.currentItem}
        </div>
        <p className="text-sm text-zinc-500">
          {player.currentStep} / {question.sequence.length}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="memory-answer" className="text-sm text-zinc-600 dark:text-zinc-400">
        Diziyi {MEMORY_TRANSFORM_LABELS[question.transform].toLocaleLowerCase("tr")} yazın.
        Boşluk veya tire kullanabilirsiniz.
      </label>
      <input
        id="memory-answer"
        type="text"
        inputMode="text"
        autoComplete="off"
        value={answer?.value ?? ""}
        onChange={(event) => onAnswer({ type: "memory_sequence", value: event.target.value })}
        placeholder="Örn: 8 1 4 9 2 7"
        className="rounded-lg border border-zinc-300 p-3 text-lg tracking-widest dark:border-zinc-700 dark:bg-transparent"
      />
    </div>
  );
}

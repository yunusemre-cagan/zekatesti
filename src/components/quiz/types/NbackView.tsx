/**
 * n-back görevinin arayüzü.
 *
 * Akış: "Başlat" → harfler sabit hızla tek tek akar → kullanıcı, ekrandaki harf n adım
 * öncekiyle aynı olduğunu düşündüğünde "Eşleşme" düğmesine basar → dizi bitince görev kapanır.
 *
 * Görev bir kez çalıştırılabilir; kullanıcı soruya geri dönerse yalnızca özetini görür.
 * Doğru cevaplar (eşleşme konumları) istemciye gönderilmez, sunucuda diziden hesaplanır.
 *
 * Kullanım: QuestionRenderer, soru tipi "nback_task" olduğunda bunu kullanır.
 */
"use client";

import { useSequencePlayer } from "@/hooks/use-sequence-player";
import type { PublicNbackQuestion } from "@/lib/questions/sanitize";
import type { NbackAnswer } from "@/lib/test/answers";

export interface NbackViewProps {
  question: PublicNbackQuestion;
  answer: NbackAnswer | undefined;
  onAnswer: (answer: NbackAnswer) => void;
  /** Görev başlatıldı mı? (oturum durumundan gelir) */
  isStarted: boolean;
  /** Görev tamamlandı mı? Tamamlandıysa dizi bir daha oynatılmaz. */
  isCompleted: boolean;
  onStart: () => void;
  onComplete: () => void;
}

export function NbackView({
  question,
  answer,
  onAnswer,
  isStarted,
  isCompleted,
  onStart,
  onComplete,
}: NbackViewProps) {
  const markedIndices = answer?.markedIndices ?? [];

  const player = useSequencePlayer(
    question.sequence,
    question.itemDisplayMs,
    isStarted && !isCompleted,
    onComplete,
  );

  // currentStep 1 tabanlıdır; dizideki konum 0 tabanlı tutulur.
  const currentIndex = player.currentStep - 1;
  const isCurrentMarked = markedIndices.includes(currentIndex);

  function markCurrent() {
    if (currentIndex < 0 || isCurrentMarked) return;
    onAnswer({ type: "nback_task", markedIndices: [...markedIndices, currentIndex] });
  }

  if (!isStarted) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="max-w-md text-center text-zinc-600 dark:text-zinc-400">
          {question.sequence.length} harf tek tek gösterilecek. Ekrandaki harf{" "}
          <strong>{question.n} önceki</strong> harfle aynı olduğunda &quot;Eşleşme&quot;
          düğmesine basın. Yanlış basmak puan düşürür; emin değilseniz basmayın. Görev
          duraklatılamaz ve tekrar başlatılamaz.
        </p>
        <button
          type="button"
          onClick={onStart}
          className="rounded-lg bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-85"
        >
          Görevi başlat
        </button>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <p className="rounded-lg border border-zinc-300 p-4 text-center text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
        Görev tamamlandı. {markedIndices.length} kez eşleşme işaretlediniz.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div
        className={`flex h-32 w-32 items-center justify-center rounded-xl border text-6xl font-semibold transition-colors ${
          isCurrentMarked ? "border-foreground bg-foreground/10" : "border-zinc-300 dark:border-zinc-700"
        }`}
        aria-live="polite"
      >
        {player.currentItem}
      </div>

      <p className="text-sm text-zinc-500">
        {Math.max(player.currentStep, 1)} / {question.sequence.length} · {question.n} önceki harfle
        karşılaştırın
      </p>

      <button
        type="button"
        onClick={markCurrent}
        disabled={isCurrentMarked || currentIndex < 0}
        className="rounded-lg bg-foreground px-8 py-4 text-lg font-medium text-background disabled:opacity-50"
      >
        {isCurrentMarked ? "İşaretlendi" : "Eşleşme"}
      </button>
    </div>
  );
}

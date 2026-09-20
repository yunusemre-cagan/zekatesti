/**
 * İşlemleme hızı görevinin arayüzü.
 *
 * Akış: "Başlat" → soruya özel geri sayım başlar → maddeler tek tek gösterilir →
 * süre dolduğunda görev kilitlenir. Görev bir kez çalıştırılabilir; kullanıcı soruya geri
 * dönerse yalnızca sonucu görür. Kalan süre, başlangıç anından hesaplandığı için sayfa
 * yenilense bile görev baştan başlamaz.
 *
 * Zorluğu belirleyen iki tasarım kararı:
 *  - Anahtar tablo yalnızca görev başlamadan önce gösterilir. Görev sırasında tabloya
 *    bakılabilseydi ölçülen şey hız değil, tabloyu okuma hızı olurdu.
 *  - `shuffleOptions` açıksa şıkların yeri her maddede değişir; böylece kullanıcı şık
 *    konumlarını ezberleyip bakmadan tıklayamaz.
 *
 * Kullanım: QuestionRenderer, soru tipi "speed_task" olduğunda bunu kullanır.
 */
"use client";

import { useCallback, useMemo } from "react";
import { useCountdown } from "@/hooks/use-countdown";
import type { PublicSpeedTaskQuestion } from "@/lib/questions/sanitize";
import type { SpeedTaskAnswer } from "@/lib/test/answers";
import { shuffleWithSeed } from "@/lib/test/shuffle";
import { formatDuration } from "@/lib/test/time";
import { MediaContent } from "../MediaContent";
import { OptionButton } from "../OptionButton";

export interface SpeedTaskViewProps {
  question: PublicSpeedTaskQuestion;
  answer: SpeedTaskAnswer | undefined;
  onAnswer: (answer: SpeedTaskAnswer) => void;
  /** Görevin başlatıldığı an (ms); başlatılmadıysa `undefined`. */
  startedAtMs: number | undefined;
  /** Görev tamamlandı mı (süre doldu veya tüm maddeler bitti)? */
  isCompleted: boolean;
  onStart: () => void;
  onComplete: () => void;
}

export function SpeedTaskView({
  question,
  answer,
  onAnswer,
  startedAtMs,
  isCompleted,
  onStart,
  onComplete,
}: SpeedTaskViewProps) {
  const responses = answer?.responses ?? {};
  const answeredCount = question.items.filter((item) => responses[item.id] !== undefined).length;
  // Cevaplanmamış ilk madde gösterilir; böylece maddeler sırayla ilerler.
  const currentItem = question.items.find((item) => responses[item.id] === undefined);

  // Şık sırası madde numarasından türetilir: aynı madde içinde sabit kalır, madde
  // değişince yeniden dizilir.
  const currentItemIndex = currentItem === undefined
    ? -1
    : question.items.findIndex((item) => item.id === currentItem.id);

  const visibleOptions = useMemo(
    () =>
      question.shuffleOptions === true && currentItemIndex >= 0
        ? shuffleWithSeed(question.options, currentItemIndex)
        : question.options,
    [question.options, question.shuffleOptions, currentItemIndex],
  );

  const handleExpire = useCallback(() => onComplete(), [onComplete]);
  const remainingSec = useCountdown({
    startedAtMs: isCompleted ? undefined : startedAtMs,
    durationSec: question.timeLimitSec,
    onExpire: handleExpire,
  });

  const selectOption = (itemId: string, optionId: string) => {
    const nextResponses = { ...responses, [itemId]: optionId };
    onAnswer({ type: "speed_task", responses: nextResponses });
    // Son madde de cevaplandıysa görev biter; kullanıcı kalan süreyi beklemez.
    if (Object.keys(nextResponses).length === question.items.length) {
      onComplete();
    }
  };

  if (startedAtMs === undefined) {
    return (
      <div className="flex flex-col items-center gap-4">
        {question.legend !== undefined && <Legend question={question} />}
        <p className="text-center text-zinc-600 dark:text-zinc-400">
          {question.legend !== undefined && (
            <>
              <strong>Anahtar tabloyu ezberleyin: görev başlayınca gizlenecek.</strong>{" "}
            </>
          )}
          {question.items.length} madde, {formatDuration(question.timeLimitSec)} süre. Süre
          başladıktan sonra duraklatılamaz; yanlış işaretler puan düşürür.
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

  if (isCompleted || currentItem === undefined) {
    return (
      <p className="rounded-lg border border-zinc-300 p-4 text-center text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
        Görev tamamlandı. {question.items.length} maddeden {answeredCount} tanesi işaretlendi.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-500">
          Madde {answeredCount + 1} / {question.items.length}
        </span>
        <span
          className={`font-mono text-lg ${remainingSec <= 10 ? "text-red-600 dark:text-red-400" : ""}`}
        >
          {formatDuration(remainingSec)}
        </span>
      </div>

      <div className="flex items-center justify-center rounded-xl border border-zinc-300 py-10 text-5xl dark:border-zinc-700">
        <MediaContent media={currentItem.stimulus} imageClassName="max-h-24" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {visibleOptions.map((option) => (
          <OptionButton
            key={option.id}
            option={option}
            isSelected={false}
            onSelect={() => selectOption(currentItem.id, option.id)}
          />
        ))}
      </div>
    </div>
  );
}

/** Sembol → karşılık anahtar tablosu; görev boyunca ekranda kalır. */
function Legend({ question }: { question: PublicSpeedTaskQuestion }) {
  return (
    <div className="flex flex-wrap justify-center gap-4 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
      {question.legend?.map((entry) => (
        <span key={entry.label} className="flex items-center gap-2 text-lg">
          <MediaContent media={entry.symbol} imageClassName="max-h-10" />
          <span className="text-zinc-500">=</span>
          <span className="font-medium">{entry.label}</span>
        </span>
      ))}
    </div>
  );
}

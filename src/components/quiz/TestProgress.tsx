/**
 * Test başlığı: kaçıncı soruda olunduğu, cevaplanan soru oranı ve o soruda geçen süre.
 *
 * Testte geri sayım yoktur; onun yerine her sorunun kendi sayacı yukarı sayar. Harcanan süre
 * puanı etkilediği için (bkz. lib/scoring/speed-factor.ts) kullanıcıya açıkça gösterilir.
 * Sayaç, sorunun beklenen süresi aşıldığında renk değiştirerek uyarır.
 *
 * Kullanım: TestRunner.
 */
"use client";

import { formatDuration } from "@/lib/test/time";

export interface TestProgressProps {
  currentIndex: number;
  totalQuestions: number;
  answeredCount: number;
  progressPercent: number;
  /** Ekrandaki soruda şimdiye kadar geçen süre (saniye). */
  questionSeconds: number;
}

export function TestProgress({
  currentIndex,
  totalQuestions,
  answeredCount,
  progressPercent,
  questionSeconds,
}: TestProgressProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span>
          Soru {currentIndex + 1} / {totalQuestions}
        </span>
        <span className="text-zinc-500">{answeredCount} soru cevaplandı</span>
        <span className="font-mono text-lg" aria-label="Bu soruda geçen süre">
          {formatDuration(questionSeconds)}
        </span>
      </div>

      <div
        className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-foreground transition-[width] duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}

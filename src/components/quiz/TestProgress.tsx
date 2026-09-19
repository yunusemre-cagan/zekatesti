/**
 * Test başlığı: kaçıncı soruda olunduğu, cevaplanan soru oranı ve kalan süre.
 *
 * Son bir dakikada sayaç kırmızıya döner; bu, yalnızca görsel bir uyarıdır,
 * süre dolduğunda testi gönderme işini TestRunner yapar.
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
  remainingSec: number;
}

export function TestProgress({
  currentIndex,
  totalQuestions,
  answeredCount,
  progressPercent,
  remainingSec,
}: TestProgressProps) {
  const isRunningOut = remainingSec <= 60;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span>
          Soru {currentIndex + 1} / {totalQuestions}
        </span>
        <span className="text-zinc-500">{answeredCount} soru cevaplandı</span>
        <span
          className={`font-mono text-lg ${isRunningOut ? "text-red-600 dark:text-red-400" : ""}`}
          aria-label="Kalan süre"
        >
          {formatDuration(remainingSec)}
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

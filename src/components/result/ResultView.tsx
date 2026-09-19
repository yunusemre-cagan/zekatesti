/**
 * Sonuç ekranının içeriği: tahmini IQ, özet sayılar, kategori dökümü ve soru açıklamaları.
 *
 * Sonuç sunucuda hesaplanır ve testin sonunda sessionStorage'a yazılır; bu bileşen yalnızca
 * okur ve gösterir. Sonuç yoksa (doğrudan /result adresine gelinmişse) kullanıcı bilgilendirilir.
 *
 * Kullanım: /result sayfası.
 */
"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { CATEGORY_LABELS } from "@/lib/questions/labels";
import type { TestResult } from "@/lib/scoring/score-test";
import type { AnswerStatus } from "@/lib/scoring/check-answer";
import { clearResult, readRawResult, subscribeToResult } from "@/lib/test/storage";
import { formatDuration } from "@/lib/test/time";

/** Cevap durumlarının ekranda gösterilen karşılıkları. */
const STATUS_LABELS: Record<AnswerStatus, string> = {
  correct: "Doğru",
  partial: "Kısmi",
  wrong: "Yanlış",
  unanswered: "Boş",
};

const STATUS_CLASSES: Record<AnswerStatus, string> = {
  correct: "text-green-700 dark:text-green-400",
  partial: "text-amber-700 dark:text-amber-400",
  wrong: "text-red-700 dark:text-red-400",
  unanswered: "text-zinc-500",
};

export function ResultView() {
  /**
   * Sonuç yalnızca tarayıcıda (sessionStorage) bulunur. Sunucuda üretilen HTML'de veri
   * olamayacağı için `useSyncExternalStore` kullanılır: sunucu anlık görüntüsü `undefined`
   * döner, tarayıcıda ise gerçek değer okunur ve bileşen yeniden çizilir.
   */
  const rawResult = useSyncExternalStore(
    subscribeToResult,
    readRawResult,
    () => null, // sunucu tarafı anlık görüntü
  );

  // Metin değişmediği sürece aynı nesne kullanılır (gereksiz yeniden çizim olmaz).
  const result = useMemo<TestResult | undefined>(() => {
    if (rawResult === null) return undefined;
    try {
      return JSON.parse(rawResult) as TestResult;
    } catch {
      return undefined;
    }
  }, [rawResult]);

  if (result === undefined) {
    return (
      <Centered>
        <p>Görüntülenecek bir sonuç bulunamadı.</p>
        <Link href="/" className="underline">
          Teste başla
        </Link>
      </Centered>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-4">
      <section className="flex flex-col items-center gap-2 pt-6 text-center">
        <p className="text-zinc-500">Tahmini IQ</p>
        <p className="text-6xl font-semibold">{result.estimatedIq}</p>
        {/* Cümle bilinçli olarak sayıya ek almayacak şekilde kuruldu: Türkçede ek, sayının
            okunuşuna göre değişir (%50'si, %99'u) ve bu dinamik olarak doğru üretilemez. */}
        <p className="text-zinc-600 dark:text-zinc-400">
          Katılımcıların yaklaşık %{result.percentile} kadarı bu sonucun altında kalır.
        </p>
      </section>

      <section className="grid grid-cols-3 gap-3 text-center">
        <SummaryCard label="Doğru" value={`${result.correctCount} / ${result.totalQuestions}`} />
        <SummaryCard label="Başarı" value={`%${Math.round(result.scoreRatio * 100)}`} />
        <SummaryCard label="Süre" value={formatDuration(result.elapsedSec)} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Kategorilere göre</h2>
        {result.categories.map((category) => (
          <div key={category.category} className="flex flex-col gap-1">
            <div className="flex justify-between text-sm">
              <span>{CATEGORY_LABELS[category.category]}</span>
              <span className="text-zinc-500">
                %{Math.round(category.ratio * 100)} ({category.questionCount} soru)
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-full bg-foreground"
                style={{ width: `${Math.round(category.ratio * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Soru soru inceleme</h2>
        <ol className="flex flex-col gap-3">
          {result.questions.map((question, index) => (
            <li
              key={question.questionId}
              className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-zinc-500">
                  {index + 1}. {CATEGORY_LABELS[question.category]}
                </span>
                <span className={STATUS_CLASSES[question.status]}>
                  {STATUS_LABELS[question.status]}
                </span>
              </div>
              {question.explanation !== undefined && (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {question.explanation}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>

      <p className="text-sm text-zinc-500">
        Bu test eğlence ve kendini değerlendirme amaçlıdır. Sonuç, klinik geçerliliği olan bir
        zeka ölçümü değildir.
      </p>

      <Link
        href="/"
        onClick={clearResult}
        className="self-center rounded-lg border border-zinc-300 px-5 py-2 dark:border-zinc-700"
      >
        Başa dön
      </Link>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="text-xl font-medium">{value}</p>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
      {children}
    </main>
  );
}

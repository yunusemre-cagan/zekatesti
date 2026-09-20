/**
 * Sonuç ekranının içeriği: tahmini IQ, özet sayılar, kategori dökümü ve soru açıklamaları.
 *
 * Sonuç sunucuda hesaplanır ve testin sonunda sessionStorage'a yazılır; bu bileşen yalnızca
 * okur ve gösterir. Sonuç yoksa (doğrudan /result adresine gelinmişse) kullanıcı bilgilendirilir.
 *
 * Kullanım: /result sayfası.
 */
"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { TestStatsResponse } from "@/lib/api/contracts";
import { ContributeForm } from "./ContributeForm";
import { CATEGORY_LABELS } from "@/lib/questions/labels";
import type { TestSubmitResponse } from "@/lib/api/contracts";
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
  const result = useMemo<TestSubmitResponse | undefined>(() => {
    if (rawResult === null) return undefined;
    try {
      return JSON.parse(rawResult) as TestSubmitResponse;
    } catch {
      return undefined;
    }
  }, [rawResult]);

  /**
   * İstatistikler: genel ortalamalar ve soru bazlı başarı oranları. Sonuç kaydedildiğinde
   * `refreshKey` artırılır ve yeni katkı hemen ortalamalara yansır.
   */
  const [stats, setStats] = useState<TestStatsResponse | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats")
      .then((response) => (response.ok ? response.json() : undefined))
      .then((data: TestStatsResponse | undefined) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        // İstatistik alınamazsa sonuç ekranı istatistiksiz çalışmaya devam eder.
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const questionStats = useMemo(
    () => new Map((stats?.questions ?? []).map((entry) => [entry.questionId, entry])),
    [stats],
  );

  const handleSaved = useCallback(() => setRefreshKey((key) => key + 1), []);

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
        <SummaryCard label="Toplam süre" value={formatDuration(result.totalSeconds)} />
      </section>

      {/* Genel ortalama: yeterli veri yoksa bölüm hiç gösterilmez. */}
      {stats !== undefined && stats.overall.participantCount > 0 && (
        <section className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          <h2 className="font-medium">Diğer katılımcılara göre</h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            {stats.overall.participantCount} katılımcının ortalaması: IQ{" "}
            {Math.round(stats.overall.averageIq)} · doğruluk %
            {Math.round(stats.overall.averageAccuracyRatio * 100)} · süre{" "}
            {formatDuration(Math.round(stats.overall.averageTotalSeconds))}
          </p>
          <p>
            {result.estimatedIq > stats.overall.averageIq
              ? `Sonucunuz ortalamanın ${result.estimatedIq - Math.round(stats.overall.averageIq)} puan üzerinde.`
              : result.estimatedIq < stats.overall.averageIq
                ? `Sonucunuz ortalamanın ${Math.round(stats.overall.averageIq) - result.estimatedIq} puan altında.`
                : "Sonucunuz tam ortalamada."}
          </p>
        </section>
      )}

      {/* Hızın puana etkisi: yalnızca doğruluk puanı ile hız çarpanı sonrası puan farklıysa gösterilir. */}
      {result.scoreRatio < result.accuracyRatio && (
        <section className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          <p>
            Yalnızca doğruluk dikkate alındığında başarınız %
            {Math.round(result.accuracyRatio * 100)} olurdu. Harcanan süre puana yansıtıldığında
            %{Math.round(result.scoreRatio * 100)} oldu:{" "}
            {result.slowQuestionCount} soruda beklenen sürenin üzerine çıkıldı.
          </p>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Kategorilere göre</h2>
        {result.categories.map((category) => (
          <div key={category.category} className="flex flex-col gap-1">
            <div className="flex justify-between text-sm">
              <span>{CATEGORY_LABELS[category.category]}</span>
              <span className="text-zinc-500">
                %{Math.round(category.ratio * 100)} ({category.questionCount} soru ·{" "}
                {formatDuration(category.seconds)})
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
                <span className="flex items-center gap-3">
                  <span
                    className={
                      question.speedFactor < 1 ? "text-amber-700 dark:text-amber-400" : "text-zinc-500"
                    }
                    title={`Beklenen süre: ${formatDuration(question.expectedSec)}`}
                  >
                    {formatDuration(question.seconds)}
                  </span>
                  <span className={STATUS_CLASSES[question.status]}>
                    {STATUS_LABELS[question.status]}
                  </span>
                </span>
              </div>
              {(() => {
                const entry = questionStats.get(question.questionId);
                if (entry === undefined || entry.answerCount === 0) return null;
                return (
                  <p className="mt-1 text-sm text-zinc-500">
                    Katılımcıların %{Math.round(entry.correctRatio * 100)}&apos;i bu soruyu doğru
                    yaptı ({entry.answerCount} kişi · ortalama{" "}
                    {formatDuration(Math.round(entry.averageSeconds))})
                  </p>
                );
              })()}

              {question.explanation !== undefined && (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {question.explanation}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>

      {result.resultToken !== undefined && (
        <ContributeForm resultToken={result.resultToken} onSaved={handleSaved} />
      )}

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

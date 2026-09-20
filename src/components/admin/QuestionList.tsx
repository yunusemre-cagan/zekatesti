/**
 * Admin soru listesi: filtreleme, düzenleme bağlantıları, aktiflik durumu ve silme.
 *
 * Silme işlemi /api/admin/questions/[id] adresine DELETE isteğiyle yapılır; sunucu doğrulama
 * ve yazma iznini kendisi kontrol eder. Liste, işlem sonrası sunucudan yeniden çekilir.
 *
 * Kullanım: /admin sayfası.
 */
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ApiErrorResponse } from "@/lib/api/contracts";
import { CATEGORY_LABELS, QUESTION_TYPE_LABELS } from "@/lib/questions/labels";
import type { Question, QuestionCategory } from "@/lib/questions/schema";

export interface QuestionListProps {
  questions: Question[];
  /** Yazma kapalıysa (production) düzenleme ve silme butonları gösterilmez. */
  canWrite: boolean;
}

export function QuestionList({ questions, canWrite }: QuestionListProps) {
  const router = useRouter();
  const [categoryFilter, setCategoryFilter] = useState<QuestionCategory | "all">("all");
  const [searchText, setSearchText] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [deletingId, setDeletingId] = useState<string | undefined>();
  /**
   * Silme onayı bekleyen sorunun kimliği. Tarayıcının `confirm` kutusu yerine satır içi onay
   * kullanılır: uygulamanın geri kalanıyla tutarlıdır ve tarayıcı diyaloglarının engellendiği
   * ortamlarda da çalışır.
   */
  const [confirmingId, setConfirmingId] = useState<string | undefined>();

  const visibleQuestions = useMemo(() => {
    const needle = searchText.trim().toLocaleLowerCase("tr");
    return questions.filter((question) => {
      const matchesCategory = categoryFilter === "all" || question.category === categoryFilter;
      const matchesText =
        needle === "" ||
        question.id.toLocaleLowerCase("tr").includes(needle) ||
        question.prompt.toLocaleLowerCase("tr").includes(needle);
      return matchesCategory && matchesText;
    });
  }, [questions, categoryFilter, searchText]);

  // Listede görünen kategoriler; boş kategorilerle filtre kalabalıklaşmasın diye.
  const usedCategories = useMemo(
    () => [...new Set(questions.map((question) => question.category))],
    [questions],
  );

  async function handleDelete(question: Question) {
    setConfirmingId(undefined);
    setDeletingId(question.id);
    setError(undefined);
    try {
      const response = await fetch(`/api/admin/questions/${question.id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json().catch(() => undefined)) as ApiErrorResponse | undefined;
        setError(body?.error ?? "Soru silinemedi.");
        return;
      }
      router.refresh();
    } catch {
      setError("Sunucuya ulaşılamadı.");
    } finally {
      setDeletingId(undefined);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Kimlik veya soru metni ara"
          className="min-w-52 flex-1 rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-transparent"
        />
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value as QuestionCategory | "all")}
          className="rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-transparent"
        >
          <option value="all">Tüm kategoriler</option>
          {usedCategories.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>

        {canWrite && (
          <Link
            href="/admin/questions/new"
            className="rounded-lg bg-foreground px-4 py-2 font-medium text-background"
          >
            Yeni soru
          </Link>
        )}
      </div>

      <p className="text-sm text-zinc-500">
        {visibleQuestions.length} soru gösteriliyor (toplam {questions.length};{" "}
        {questions.filter((question) => question.active).length} aktif).
      </p>

      {error !== undefined && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <ul className="flex flex-col gap-2">
        {visibleQuestions.map((question) => (
          <li
            key={question.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-2 text-sm text-zinc-500">
                <code>{question.id}</code>
                <span>·</span>
                <span>{CATEGORY_LABELS[question.category]}</span>
                <span>·</span>
                <span>{QUESTION_TYPE_LABELS[question.type]}</span>
                <span>·</span>
                <span>Zorluk {question.difficulty}</span>
                {!question.active && (
                  <span className="rounded bg-zinc-200 px-1.5 text-xs dark:bg-zinc-800">pasif</span>
                )}
              </span>
              <span className="truncate">{question.prompt}</span>
            </div>

            {canWrite && confirmingId !== question.id && (
              <div className="flex gap-2">
                <Link
                  href={`/admin/questions/${question.id}`}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
                >
                  Düzenle
                </Link>
                <button
                  type="button"
                  onClick={() => setConfirmingId(question.id)}
                  disabled={deletingId === question.id}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
                >
                  {deletingId === question.id ? "Siliniyor…" : "Sil"}
                </button>
              </div>
            )}

            {canWrite && confirmingId === question.id && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">Silinsin mi? Geri alınamaz.</span>
                <button
                  type="button"
                  onClick={() => void handleDelete(question)}
                  className="rounded-lg bg-red-700 px-3 py-1.5 text-white"
                >
                  Evet, sil
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingId(undefined)}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 dark:border-zinc-700"
                >
                  Vazgeç
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {visibleQuestions.length === 0 && (
        <p className="text-zinc-500">Bu filtreye uyan soru yok.</p>
      )}
    </div>
  );
}

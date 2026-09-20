/**
 * Soru ekleme/düzenleme formu.
 *
 * Form, `QuestionDraft` (lib/admin/draft.ts) üzerinde çalışır: alanların tümü metin olarak
 * tutulur, kaydederken `draftToQuestion` ile gerçek soruya çevrilir ve Zod ile doğrulanır.
 * Doğrulama kuralları burada tekrarlanmaz; hata mesajları şemadan gelir.
 *
 * Kullanım: /admin/questions/new ve /admin/questions/[id] sayfaları.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiErrorResponse } from "@/lib/api/contracts";
import { QUESTION_TIME } from "@/lib/config";
import {
  createEmptyDraft,
  draftToQuestion,
  type DraftOption,
  type QuestionDraft,
} from "@/lib/admin/draft";
import {
  CATEGORY_LABELS,
  MEMORY_TRANSFORM_LABELS,
  QUESTION_TYPE_LABELS,
} from "@/lib/questions/labels";
import {
  ANSWER_FORMATS,
  MEMORY_TRANSFORMS,
  QUESTION_CATEGORIES,
  QUESTION_TYPES,
  type AnswerFormat,
  type MemoryTransform,
  type QuestionCategory,
  type QuestionType,
} from "@/lib/questions/schema";
import { ImageField } from "./ImageField";

export interface QuestionFormProps {
  /** Düzenleme formunda mevcut sorunun taslağı; yeni soruda `undefined`. */
  initialDraft?: QuestionDraft;
  /** Düzenlemede kimlik değiştirilemez. */
  mode: "create" | "edit";
}

export function QuestionForm({ initialDraft, mode }: QuestionFormProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<QuestionDraft>(initialDraft ?? createEmptyDraft());
  const [errors, setErrors] = useState<string[]>([]);
  const [isSaving, setSaving] = useState(false);

  /** Taslağın tek bir alanını günceller. */
  function update<K extends keyof QuestionDraft>(key: K, value: QuestionDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateOption(index: number, patch: Partial<DraftOption>) {
    setDraft((current) => ({
      ...current,
      options: current.options.map((option, i) => (i === index ? { ...option, ...patch } : option)),
    }));
  }

  function addOption() {
    setDraft((current) => {
      // Sıradaki harf kimliği (a, b, c ...) otomatik verilir.
      const nextId = String.fromCharCode(97 + current.options.length);
      return { ...current, options: [...current.options, { id: nextId, text: "", image: "" }] };
    });
  }

  function removeOption(index: number) {
    setDraft((current) => ({
      ...current,
      options: current.options.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors([]);

    const conversion = draftToQuestion(draft);
    if (!conversion.ok) {
      setErrors(conversion.errors);
      return;
    }

    setSaving(true);
    try {
      const url =
        mode === "create" ? "/api/admin/questions" : `/api/admin/questions/${draft.id.trim()}`;
      const response = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(conversion.question),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => undefined)) as ApiErrorResponse | undefined;
        setErrors([body?.error ?? "Soru kaydedilemedi.", ...(body?.details ?? [])]);
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setErrors(["Sunucuya ulaşılamadı."]);
    } finally {
      setSaving(false);
    }
  }

  // Şık listesi yalnızca şıkla cevaplanan tiplerde gösterilir.
  const showsOptions =
    draft.type === "single_choice" || draft.type === "multi_choice" || draft.type === "speed_task";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Kimlik (URL ve klasör adı olarak kullanılır)">
          <input
            type="text"
            value={draft.id}
            onChange={(event) => update("id", event.target.value)}
            disabled={mode === "edit"}
            placeholder="ornek-soru-01"
            className={inputClass}
          />
        </Field>

        <Field label="Soru tipi">
          <select
            value={draft.type}
            onChange={(event) => update("type", event.target.value as QuestionType)}
            className={inputClass}
          >
            {QUESTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {QUESTION_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Kategori">
          <select
            value={draft.category}
            onChange={(event) => update("category", event.target.value as QuestionCategory)}
            className={inputClass}
          >
            {QUESTION_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Zorluk (puan ağırlığı ve beklenen süre)">
          <select
            value={draft.difficulty}
            onChange={(event) => update("difficulty", Number(event.target.value) as 1 | 2 | 3)}
            className={inputClass}
          >
            {/* Süreler config'ten okunur; eşikler değişirse etiketler kendiliğinden güncellenir. */}
            {([1, 2, 3] as const).map((level) => (
              <option key={level} value={level}>
                {level} — {["Kolay", "Orta", "Zor"][level - 1]} (
                {QUESTION_TIME.EXPECTED_SEC_BY_DIFFICULTY[level]} sn)
              </option>
            ))}
          </select>
        </Field>

        <Field label="Beklenen süre (saniye, boş bırakılırsa zorluğa göre)">
          <input
            type="number"
            min={5}
            max={600}
            value={draft.expectedSec}
            onChange={(event) => update("expectedSec", event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Durum">
          <label className="flex items-center gap-2 p-2">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => update("active", event.target.checked)}
            />
            <span>Aktif (teste dahil edilir)</span>
          </label>
        </Field>
      </section>

      <Field label="Soru metni">
        <textarea
          value={draft.prompt}
          onChange={(event) => update("prompt", event.target.value)}
          rows={3}
          className={inputClass}
        />
      </Field>

      <ImageField
        label="Soru görseli (isteğe bağlı)"
        questionId={draft.id}
        value={draft.promptImage}
        onChange={(value) => update("promptImage", value)}
      />

      {showsOptions && (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium">Şıklar</h2>
          {draft.type === "speed_task" && (
            <p className="text-sm text-zinc-500">
              Hız görevinde şıklar tüm maddeler için ortaktır.
            </p>
          )}

          {draft.options.map((option, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={option.id}
                  onChange={(event) => updateOption(index, { id: event.target.value })}
                  placeholder="a"
                  className="w-16 rounded-lg border border-zinc-300 p-2 text-center dark:border-zinc-700 dark:bg-transparent"
                />
                <input
                  type="text"
                  value={option.text}
                  onChange={(event) => updateOption(index, { text: event.target.value })}
                  placeholder="Şık metni"
                  className="min-w-40 flex-1 rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-transparent"
                />

                {draft.type === "single_choice" && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="correctOption"
                      checked={draft.correctOptionId === option.id}
                      onChange={() => update("correctOptionId", option.id)}
                    />
                    Doğru
                  </label>
                )}

                {draft.type === "multi_choice" && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.correctOptionIds.includes(option.id)}
                      onChange={(event) =>
                        update(
                          "correctOptionIds",
                          event.target.checked
                            ? [...draft.correctOptionIds, option.id]
                            : draft.correctOptionIds.filter((id) => id !== option.id),
                        )
                      }
                    />
                    Doğru
                  </label>
                )}

                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  className="rounded-lg border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700"
                >
                  Sil
                </button>
              </div>

              <ImageField
                label="Şık görseli (isteğe bağlı)"
                questionId={draft.id}
                value={option.image}
                onChange={(value) => updateOption(index, { image: value })}
              />
            </div>
          ))}

          <button
            type="button"
            onClick={addOption}
            className="self-start rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
          >
            Şık ekle
          </button>
        </section>
      )}

      {draft.type === "memory_sequence" && (
        <section className="grid gap-4 sm:grid-cols-3">
          <Field label="Dizi (rakam/harf, boşlukla ayırın)">
            <input
              type="text"
              value={draft.sequence}
              onChange={(event) => update("sequence", event.target.value)}
              placeholder="7 2 9 4 1 8"
              className={inputClass}
            />
          </Field>
          <Field label="Öğe gösterim süresi (ms)">
            <input
              type="number"
              min={300}
              max={5000}
              value={draft.itemDisplayMs}
              onChange={(event) => update("itemDisplayMs", event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="İstenen yazım biçimi">
            <select
              value={draft.transform}
              onChange={(event) => update("transform", event.target.value as MemoryTransform)}
              className={inputClass}
            >
              {MEMORY_TRANSFORMS.map((transform) => (
                <option key={transform} value={transform}>
                  {MEMORY_TRANSFORM_LABELS[transform]}
                </option>
              ))}
            </select>
          </Field>
        </section>
      )}

      {draft.type === "open_answer" && (
        <section className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cevap biçimi">
              <select
                value={draft.answerFormat}
                onChange={(event) => update("answerFormat", event.target.value as AnswerFormat)}
                className={inputClass}
              >
                {ANSWER_FORMATS.map((format) => (
                  <option key={format} value={format}>
                    {format === "number" ? "Sayı" : "Metin"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cevap kutusu ipucu (isteğe bağlı)">
              <input
                type="text"
                value={draft.placeholder}
                onChange={(event) => update("placeholder", event.target.value)}
                placeholder="Örn: 42"
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Kabul edilen cevaplar (her satıra bir cevap)">
            <textarea
              value={draft.acceptedAnswers}
              onChange={(event) => update("acceptedAnswers", event.target.value)}
              rows={3}
              placeholder={"33\notuz üç"}
              className={inputClass}
            />
          </Field>
          <p className="text-sm text-zinc-500">
            Sayı biçiminde boşluk, binlik ayracı ve ondalık virgül farkı göz ardı edilir; metin
            biçiminde büyük-küçük harf farkı göz ardı edilir.
          </p>
        </section>
      )}

      {draft.type === "nback_task" && (
        <section className="grid gap-4 sm:grid-cols-3">
          <Field label="n (kaç önceki ile karşılaştırılacak)">
            <input
              type="number"
              min={1}
              max={3}
              value={draft.nbackN}
              onChange={(event) => update("nbackN", event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Akacak dizi (harf/rakam, boşlukla ayırın)">
            <input
              type="text"
              value={draft.nbackSequence}
              onChange={(event) => update("nbackSequence", event.target.value)}
              placeholder="K M K T R T Z K"
              className={inputClass}
            />
          </Field>
          <Field label="Öğe gösterim süresi (ms)">
            <input
              type="number"
              min={800}
              max={4000}
              value={draft.nbackItemDisplayMs}
              onChange={(event) => update("nbackItemDisplayMs", event.target.value)}
              className={inputClass}
            />
          </Field>
        </section>
      )}

      {draft.type === "speed_task" && (
        <SpeedTaskFields draft={draft} setDraft={setDraft} />
      )}

      <Field label="Çözüm açıklaması (sonuç ekranında gösterilir)">
        <textarea
          value={draft.explanation}
          onChange={(event) => update("explanation", event.target.value)}
          rows={2}
          className={inputClass}
        />
      </Field>

      {errors.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-lg border border-red-300 p-3 text-sm text-red-700 dark:border-red-900 dark:text-red-400">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-foreground px-5 py-2 font-medium text-background disabled:opacity-50"
        >
          {isSaving ? "Kaydediliyor…" : "Kaydet"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="rounded-lg border border-zinc-300 px-5 py-2 dark:border-zinc-700"
        >
          Vazgeç
        </button>
      </div>
    </form>
  );
}

/**
 * Hız görevine özel alanlar: süre, anahtar tablo (lejant) ve maddeler.
 * Ayrı bir bileşene alındı; ana form zaten uzun ve bu alanlar yalnızca tek bir tipte görünür.
 */
function SpeedTaskFields({
  draft,
  setDraft,
}: {
  draft: QuestionDraft;
  setDraft: React.Dispatch<React.SetStateAction<QuestionDraft>>;
}) {
  return (
    <section className="flex flex-col gap-4">
      <Field label="Görev süresi (saniye)">
        <input
          type="number"
          min={10}
          max={300}
          value={draft.timeLimitSec}
          onChange={(event) =>
            setDraft((current) => ({ ...current, timeLimitSec: event.target.value }))
          }
          className={`${inputClass} max-w-40`}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Anahtar tablo (isteğe bağlı)</h2>
        {draft.legend.map((entry, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={entry.text}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  legend: current.legend.map((item, i) =>
                    i === index ? { ...item, text: event.target.value } : item,
                  ),
                }))
              }
              placeholder="Sembol (ör. ★)"
              className="w-32 rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-transparent"
            />
            <span className="text-zinc-500">=</span>
            <input
              type="text"
              value={entry.label}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  legend: current.legend.map((item, i) =>
                    i === index ? { ...item, label: event.target.value } : item,
                  ),
                }))
              }
              placeholder="Karşılığı (ör. 1)"
              className="w-32 rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-transparent"
            />
            <button
              type="button"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  legend: current.legend.filter((_, i) => i !== index),
                }))
              }
              className="rounded-lg border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700"
            >
              Sil
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setDraft((current) => ({
              ...current,
              legend: [...current.legend, { text: "", image: "", label: "" }],
            }))
          }
          className="self-start rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
        >
          Anahtar satırı ekle
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Maddeler</h2>
        <p className="text-sm text-zinc-500">
          Her madde bir uyaran (sembol/görsel) ve yukarıdaki ortak şıklardan birinin kimliğini alır.
        </p>
        {draft.items.map((item, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={item.id}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  items: current.items.map((entry, i) =>
                    i === index ? { ...entry, id: event.target.value } : entry,
                  ),
                }))
              }
              placeholder="i1"
              className="w-20 rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-transparent"
            />
            <input
              type="text"
              value={item.text}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  items: current.items.map((entry, i) =>
                    i === index ? { ...entry, text: event.target.value } : entry,
                  ),
                }))
              }
              placeholder="Uyaran (ör. ★)"
              className="w-40 rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-transparent"
            />
            <input
              type="text"
              value={item.correctOptionId}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  items: current.items.map((entry, i) =>
                    i === index ? { ...entry, correctOptionId: event.target.value } : entry,
                  ),
                }))
              }
              placeholder="Doğru şık kimliği"
              className="w-40 rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-transparent"
            />
            <button
              type="button"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  items: current.items.filter((_, i) => i !== index),
                }))
              }
              className="rounded-lg border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700"
            >
              Sil
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setDraft((current) => ({
              ...current,
              items: [
                ...current.items,
                { id: `i${current.items.length + 1}`, text: "", image: "", correctOptionId: "" },
              ],
            }))
          }
          className="self-start rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
        >
          Madde ekle
        </button>
      </div>
    </section>
  );
}

const inputClass =
  "rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-transparent disabled:opacity-60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-zinc-600 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

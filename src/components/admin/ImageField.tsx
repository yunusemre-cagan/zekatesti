/**
 * Görsel alanı: dosya yükler veya elle yol girilmesine izin verir, seçili görseli önizler.
 *
 * Yükleme /api/admin/upload adresine yapılır; sunucu dosyayı
 * `public/questions/<soru-kimliği>/` altına kaydeder ve veriye yazılacak yolu döner.
 *
 * Kullanım: QuestionForm içindeki tüm görsel alanları (soru görseli, şık görselleri,
 * hız görevi sembolleri).
 */
"use client";

import { useState } from "react";
import type { ApiErrorResponse } from "@/lib/api/contracts";

export interface ImageFieldProps {
  label: string;
  /** Görselin bağlanacağı sorunun kimliği; yükleme klasörünü belirler. */
  questionId: string;
  value: string;
  onChange: (value: string) => void;
}

export function ImageField({ label, questionId, value, onChange }: ImageFieldProps) {
  const [isUploading, setUploading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleFile(file: File) {
    setUploading(true);
    setError(undefined);

    const formData = new FormData();
    formData.append("questionId", questionId.trim());
    formData.append("file", file);

    try {
      const response = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const body = (await response.json().catch(() => undefined)) as
        | { path?: string }
        | ApiErrorResponse
        | undefined;

      if (!response.ok) {
        setError((body as ApiErrorResponse | undefined)?.error ?? "Dosya yüklenemedi.");
        return;
      }
      const uploadedPath = (body as { path?: string } | undefined)?.path;
      if (uploadedPath !== undefined) onChange(uploadedPath);
    } catch {
      setError("Sunucuya ulaşılamadı.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-zinc-600 dark:text-zinc-400">{label}</span>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="/questions/soru-kimligi/gorsel.svg"
          className="min-w-52 flex-1 rounded-lg border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-transparent"
        />
        <input
          type="file"
          accept="image/svg+xml,image/png,image/jpeg,image/webp,image/gif"
          disabled={isUploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) void handleFile(file);
            // Aynı dosya tekrar seçilebilsin diye alan sıfırlanır.
            event.target.value = "";
          }}
          className="text-sm"
        />
        {value !== "" && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="rounded-lg border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700"
          >
            Kaldır
          </button>
        )}
      </div>

      {isUploading && <p className="text-sm text-zinc-500">Yükleniyor…</p>}
      {error !== undefined && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {value !== "" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className="max-h-28 w-auto self-start rounded border border-zinc-200 object-contain dark:border-zinc-800"
        />
      )}
    </div>
  );
}

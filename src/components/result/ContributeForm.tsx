/**
 * Sonuç ekranındaki isteğe bağlı katkı formu.
 *
 * Kullanıcı onay kutusunu işaretlemedikçe hiçbir veri gönderilmez; form atlanabilir ve
 * atlandığında sonuç ekranı normal çalışır. Doğum yılı, cinsiyet ve il alanlarının üçü de
 * boş bırakılabilir — onay verip hiçbir alanı doldurmamak da geçerli bir tercihtir.
 *
 * Gönderilen paket, sunucunun testi puanlarken imzaladığı sonuçtur; bu bileşen puanları
 * kendisi hesaplamaz veya değiştiremez.
 *
 * Kullanım: ResultView, sonuç kaydı açıkken (resultToken geldiyse) bu formu gösterir.
 */
"use client";

import { useState } from "react";
import type { ApiErrorResponse, SaveResultRequest } from "@/lib/api/contracts";
import { PROVINCES } from "@/lib/demographics/provinces";
import {
  GENDERS,
  GENDER_LABELS,
  MAX_BIRTH_YEAR,
  MIN_BIRTH_YEAR,
  type Gender,
} from "@/lib/results/schema";
import { getOrCreateParticipantId } from "@/lib/test/participant";

export interface ContributeFormProps {
  /** Sunucunun imzaladığı sonuç paketi. */
  resultToken: string;
  /** Kayıt başarılı olduğunda çağrılır (istatistikleri tazelemek için). */
  onSaved: () => void;
}

export function ContributeForm({ resultToken, onSaved }: ContributeFormProps) {
  const [hasConsent, setConsent] = useState(false);
  const [birthYear, setBirthYear] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [provinceCode, setProvinceCode] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!hasConsent) return;

    setState("saving");
    setError(undefined);

    const body: SaveResultRequest = {
      resultToken,
      participantId: getOrCreateParticipantId(),
      // Boş bırakılan alanlar hiç gönderilmez; sunucuda da isteğe bağlıdırlar.
      ...(birthYear !== "" && { birthYear: Number(birthYear) }),
      ...(gender !== "" && { gender }),
      ...(provinceCode !== "" && { provinceCode: Number(provinceCode) }),
    };

    try {
      const response = await fetch("/api/results", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => undefined)) as
          | ApiErrorResponse
          | undefined;
        setError(errorBody?.error ?? "Sonuç kaydedilemedi.");
        setState("idle");
        return;
      }

      setState("saved");
      onSaved();
    } catch {
      setError("Sunucuya ulaşılamadı.");
      setState("idle");
    }
  }

  if (state === "saved") {
    return (
      <section className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <p>Teşekkürler. Sonucunuz istatistiklere eklendi.</p>
      </section>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">İstatistiklere katkıda bulunun (isteğe bağlı)</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Onay verirseniz sonucunuz, diğer katılımcılarla karşılaştırma yapılabilmesi için
          saklanır. Adınız, e-postanız veya IP adresiniz kaydedilmez. Aşağıdaki üç alan da
          isteğe bağlıdır; boş bırakabilirsiniz.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Doğum yılı</span>
          <input
            type="number"
            min={MIN_BIRTH_YEAR}
            max={MAX_BIRTH_YEAR}
            value={birthYear}
            onChange={(event) => setBirthYear(event.target.value)}
            placeholder="Örn: 1995"
            className="rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-transparent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Cinsiyet</span>
          <select
            value={gender}
            onChange={(event) => setGender(event.target.value as Gender | "")}
            className="rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-transparent"
          >
            <option value="">Seçilmedi</option>
            {GENDERS.map((value) => (
              <option key={value} value={value}>
                {GENDER_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">İl</span>
          <select
            value={provinceCode}
            onChange={(event) => setProvinceCode(event.target.value)}
            className="rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-transparent"
          >
            <option value="">Seçilmedi</option>
            {PROVINCES.map((province) => (
              <option key={province.code} value={province.code}>
                {province.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={hasConsent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-1"
        />
        <span>
          Sonucumun ve girdiğim bilgilerin anonim istatistiklerde kullanılmasını onaylıyorum.
        </span>
      </label>

      {error !== undefined && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={!hasConsent || state === "saving"}
        className="self-start rounded-lg bg-foreground px-5 py-2 font-medium text-background disabled:opacity-50"
      >
        {state === "saving" ? "Kaydediliyor…" : "Sonucumu ekle"}
      </button>
    </form>
  );
}

/**
 * Admin giriş formu.
 *
 * Şifreyi /api/admin/session adresine gönderir; doğruysa sunucu oturum çerezini yazar ve
 * kullanıcı panele yönlendirilir. Şifre karşılaştırması tamamen sunucuda yapılır.
 *
 * Kullanım: /admin/login sayfası.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiErrorResponse } from "@/lib/api/contracts";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => undefined)) as ApiErrorResponse | undefined;
        setError(body?.error ?? "Giriş yapılamadı.");
        return;
      }

      // Sunucu bileşenlerinin oturum durumunu yeniden okuması için yenileme gerekir.
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Sunucuya ulaşılamadı.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label htmlFor="password" className="text-sm text-zinc-600 dark:text-zinc-400">
        Şifre
      </label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="rounded-lg border border-zinc-300 p-3 dark:border-zinc-700 dark:bg-transparent"
      />

      {error !== undefined && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting || password === ""}
        className="rounded-lg bg-foreground px-5 py-3 font-medium text-background disabled:opacity-50"
      >
        {isSubmitting ? "Kontrol ediliyor…" : "Giriş yap"}
      </button>
    </form>
  );
}

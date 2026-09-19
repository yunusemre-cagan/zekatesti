"use client";

/**
 * Yukarı sayan sayaç: ekrandaki soruda şu ana kadar geçen süreyi saniye olarak verir.
 *
 * Süre, oturum durumundaki kayıtlı süre ile o an işleyen süreden hesaplanır
 * (bkz. lib/test/session.ts → getCurrentQuestionSeconds); burada yalnızca saniyede bir
 * yeniden hesaplama tetiklenir.
 *
 * Kullanım: TestProgress bileşenindeki soru sayacı.
 */
import { useEffect, useState } from "react";
import { getCurrentQuestionSeconds, type TestSessionState } from "@/lib/test/session";

export function useCurrentQuestionSeconds(state: TestSessionState): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    // setState yalnızca zamanlayıcı geri çağrısında yapılır (render sırasında değil).
    const intervalId = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(intervalId);
  }, []);

  return getCurrentQuestionSeconds(state, nowMs);
}

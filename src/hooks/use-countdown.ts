"use client";

/**
 * Geri sayım hook'u: bir başlangıç anından itibaren kalan saniyeyi verir.
 *
 * Kalan süre bir sayaç değişkeni azaltılarak değil, her saniye "şu an"dan yeniden
 * hesaplanarak bulunur; böylece sekme arka plana alındığında tarayıcı zamanlayıcıyı
 * yavaşlatsa bile süre kaymaz.
 *
 * Kullanım: Testin toplam sayacı (TestRunner) ve hız görevinin kendi sayacı (SpeedTaskView).
 */
import { useEffect, useRef, useState } from "react";
import { getRemainingSec } from "@/lib/test/time";

export interface CountdownOptions {
  /** Başlangıç anı (ms, epoch). `undefined` ise sayaç çalışmaz. */
  startedAtMs: number | undefined;
  durationSec: number;
  /** Süre sıfıra ulaştığında bir kez çağrılır. */
  onExpire?: () => void;
}

/** Kalan saniyeyi döner. Sayaç başlamamışsa `durationSec` döner. */
export function useCountdown({ startedAtMs, durationSec, onExpire }: CountdownOptions): number {
  // Yalnızca "şu an" durumda tutulur; kalan süre bundan türetilir.
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (startedAtMs === undefined) return;
    // setState zamanlayıcı geri çağrısında yapılır (render sırasında değil).
    const intervalId = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(intervalId);
  }, [startedAtMs]);

  const remainingSec =
    startedAtMs === undefined ? durationSec : getRemainingSec(startedAtMs, durationSec, nowMs);

  // onExpire'ın kimliği her render'da değişebildiği için ref'te tutulur ve effect içinde güncellenir.
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    // Bağımlılık yalnızca kalan süre olduğu için, süre 0'da kaldığı sürece bu effect
    // yeniden çalışmaz; yani onExpire tam olarak bir kez çağrılır.
    if (startedAtMs !== undefined && remainingSec === 0) {
      onExpireRef.current?.();
    }
  }, [remainingSec, startedAtMs]);

  return remainingSec;
}

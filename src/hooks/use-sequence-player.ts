"use client";

/**
 * Bellek sorusunun dizi oynatıcısı: öğeleri tek tek, belirtilen süre boyunca gösterir.
 *
 * Oynatma bittiğinde `onFinished` çağrılır; dizinin bir daha gösterilmemesi (çalışma belleği
 * ölçümünün geçerli kalması için) çağıran bileşenin sorumluluğundadır.
 *
 * Kullanım: MemorySequenceView bileşeni.
 */
import { useEffect, useRef, useState } from "react";

export interface SequencePlayerState {
  /** Ekranda gösterilen öğe; oynatma sürmüyorsa `undefined`. */
  currentItem: string | undefined;
  /** Gösterilen öğenin sırası (1 tabanlı); gösterim yoksa 0. */
  currentStep: number;
  isPlaying: boolean;
}

/**
 * @param sequence Gösterilecek öğeler.
 * @param itemDisplayMs Her öğenin ekranda kalma süresi.
 * @param isPlaying Oynatmanın başlatılıp başlatılmadığı (bileşen kontrol eder).
 * @param onFinished Son öğe de gösterildikten sonra çağrılır.
 */
export function useSequencePlayer(
  sequence: readonly string[],
  itemDisplayMs: number,
  isPlaying: boolean,
  onFinished: () => void,
): SequencePlayerState {
  const [step, setStep] = useState(0);

  // onFinished'in kimliği her render'da değişebildiği için ref'te tutulur (effect içinde güncellenir).
  const onFinishedRef = useRef(onFinished);
  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    if (!isPlaying) return;

    let currentStep = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    // Adımlar zamanlayıcı geri çağrısında ilerletilir; ilk öğe de 0 ms'lik gecikmeyle
    // gösterilir, böylece render sırasında durum güncellenmemiş olur.
    const advance = () => {
      currentStep += 1;
      if (currentStep > sequence.length) {
        setStep(0);
        onFinishedRef.current();
        return;
      }
      setStep(currentStep);
      timeoutId = setTimeout(advance, itemDisplayMs);
    };

    timeoutId = setTimeout(advance, 0);
    return () => clearTimeout(timeoutId);
  }, [isPlaying, itemDisplayMs, sequence.length]);

  return {
    currentItem: isPlaying && step > 0 ? sequence[step - 1] : undefined,
    currentStep: step,
    isPlaying: isPlaying && step > 0,
  };
}

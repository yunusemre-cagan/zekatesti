/**
 * Açılış sayfası (/).
 *
 * Bilinçli olarak sade tutuldu: üyelik/giriş yoktur, tek bir "Teste Başla" butonu
 * kullanıcıyı doğrudan test ekranına götürür.
 *
 * Kullanım: Sitenin kök adresi; kullanıcının gördüğü ilk ekran.
 */
import Link from "next/link";
import { TEST_DURATION_SEC } from "@/lib/config";

export default function HomePage() {
  const durationMinutes = TEST_DURATION_SEC / 60;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-3xl font-semibold">IQ Testi</h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Toplam süre {durationMinutes} dakikadır. Süre dolduğunda test otomatik olarak tamamlanır.
      </p>
      <Link
        href="/test"
        className="rounded-lg bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-85"
      >
        Teste Başla
      </Link>
    </main>
  );
}

/**
 * Sonuç sayfası (/result).
 *
 * İçerik istemci tarafında (sessionStorage'daki puanlanmış sonuçtan) çizilir; bu sayfa
 * yalnızca ResultView'ı yerleştirir.
 *
 * Kullanım: Test gönderildikten sonra buraya yönlendirilir.
 */
import { ResultView } from "@/components/result/ResultView";

export const metadata = {
  title: "IQ Testi — Sonuç",
};

export default function ResultPage() {
  return <ResultView />;
}

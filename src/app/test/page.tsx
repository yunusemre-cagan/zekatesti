/**
 * Test ekranı (/).
 *
 * Sayfanın kendisi sunucu bileşenidir ve yalnızca istemci bileşeni olan TestRunner'ı çizer;
 * sorular tarayıcıdan /api/test/start ile alınır.
 *
 * Kullanım: Açılış sayfasındaki "Teste Başla" bağlantısı buraya yönlendirir.
 */
import { TestRunner } from "@/components/quiz/TestRunner";

export const metadata = {
  title: "IQ Testi — Sorular",
};

export default function TestPage() {
  return <TestRunner />;
}

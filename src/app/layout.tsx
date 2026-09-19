/**
 * Kök layout: tüm sayfaları saran ortak HTML iskeleti.
 *
 * Harici (Google) font kullanılmıyor; sistem fontu hem Türkçe karakterleri sorunsuz
 * gösterir hem de build sırasında ağ bağımlılığı oluşturmaz.
 */
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IQ Testi",
  description: "Kısa ve hızlı çevrim içi IQ testi.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

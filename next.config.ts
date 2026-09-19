import type { NextConfig } from "next";

/**
 * Next.js yapılandırması.
 */
const nextConfig: NextConfig = {
  /**
   * Sorular çalışma anında `fs` ile `data/questions.json` dosyasından okunur. Dosya yolu
   * `process.cwd()` ile dinamik oluşturulduğu için Next.js'in dosya izleyicisi onu otomatik
   * bulamayabilir; bu ayar dosyanın Vercel'deki sunucu paketine her rotada eklenmesini garanti eder.
   */
  outputFileTracingIncludes: {
    "/**": ["./data/questions.json"],
  },
};

export default nextConfig;

/**
 * Vitest yapılandırması.
 *
 * Birim testler yalnızca React'ten bağımsız saf fonksiyonları (puanlama, sıralama,
 * cevap kontrolü vb.) kapsar; bu yüzden tarayıcı ortamı yerine "node" ortamı yeterlidir.
 */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // tsconfig.json içindeki "@/*" yol takma adının testlerde de çalışması için.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

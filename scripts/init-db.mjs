/**
 * Veritabanı tablolarını oluşturur (db/schema.sql dosyasını çalıştırır).
 *
 * Çalıştırma:
 *   POSTGRES_URL="postgres://..." node scripts/init-db.mjs
 * veya `.env.local` içinde POSTGRES_URL tanımlıysa:
 *   npm run db:init
 *
 * Script tekrar çalıştırılmaya dayanıklıdır: tablolar varsa dokunmaz (IF NOT EXISTS).
 *
 * Kullanım: Yalnızca kurulum sırasında elle çalıştırılır; uygulama bunu kendisi çağırmaz.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** `.env.local` dosyasındaki değişkenleri okur (Next.js dışında çalıştığımız için). */
async function loadEnvLocal() {
  try {
    const raw = await readFile(path.join(projectRoot, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (match === null) continue;
      const [, key, rawValue] = match;
      if (process.env[key] === undefined) {
        process.env[key] = rawValue.replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // .env.local yoksa sorun değil; değişken ortamdan gelebilir.
  }
}

async function main() {
  await loadEnvLocal();

  const connectionString = process.env.POSTGRES_URL;
  if (connectionString === undefined || connectionString === "") {
    console.error(
      "POSTGRES_URL tanımlı değil.\n" +
        "Vercel panelinden veritabanını oluşturup bağlantı adresini .env.local dosyasına ekleyin:\n" +
        '  POSTGRES_URL="postgres://..."',
    );
    process.exit(1);
  }

  const schema = await readFile(path.join(projectRoot, "db", "schema.sql"), "utf8");
  const client = new pg.Client({ connectionString });

  await client.connect();
  try {
    // Tüm dosya tek seferde çalıştırılır; hata olursa hiçbiri uygulanmaz.
    await client.query(schema);
    console.log("Veritabanı hazır: tablolar ve indeksler oluşturuldu.");
  } finally {
    await client.end();
  }
}

await main();

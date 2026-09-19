/**
 * Repoya işlenen gerçek soru verisinin (data/questions.json) bütünlük testi.
 *
 * Soru dosyası elle veya admin paneliyle düzenlenebildiği için, bozuk bir verinin
 * deploy edilmeden önce yakalanması amaçlanır:
 *  - dosya şemaya uygun olmalı,
 *  - referans verilen her görsel `public/` altında gerçekten bulunmalı.
 */
import { access } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createJsonQuestionRepository, QUESTIONS_FILE_PATH } from "./repository";
import type { Question } from "./schema";

const PUBLIC_DIR = path.join(process.cwd(), "public");

/** Bir sorunun referans verdiği tüm görsel yollarını toplar. */
function collectImagePaths(question: Question): string[] {
  const paths: (string | undefined)[] = [question.promptImage];

  switch (question.type) {
    case "single_choice":
    case "multi_choice":
      paths.push(...question.options.map((o) => o.image));
      break;
    case "speed_task":
      paths.push(...question.options.map((o) => o.image));
      paths.push(...question.items.map((item) => item.stimulus.image));
      paths.push(...(question.legend ?? []).map((entry) => entry.symbol.image));
      break;
    case "memory_sequence":
      break;
  }

  return paths.filter((p): p is string => p !== undefined);
}

describe("data/questions.json", () => {
  const repo = createJsonQuestionRepository({ filePath: QUESTIONS_FILE_PATH, readOnly: true });

  it("şemaya uygundur", async () => {
    await expect(repo.getAll()).resolves.toBeInstanceOf(Array);
  });

  it("referans verilen tüm görseller public/ altında mevcuttur", async () => {
    const questions = await repo.getAll();
    const missing: string[] = [];

    for (const question of questions) {
      for (const imagePath of collectImagePaths(question)) {
        try {
          await access(path.join(PUBLIC_DIR, imagePath));
        } catch {
          missing.push(`${question.id}: ${imagePath}`);
        }
      }
    }

    expect(missing, "Eksik görseller").toEqual([]);
  });
});

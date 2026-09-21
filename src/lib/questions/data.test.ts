/**
 * Repoya işlenen gerçek soru verisinin (data/questions.json) bütünlük testi.
 *
 * Soru dosyası elle veya admin paneliyle düzenlenebildiği için, bozuk bir verinin
 * deploy edilmeden önce yakalanması amaçlanır:
 *  - dosya şemaya uygun olmalı,
 *  - referans verilen her görsel `public/` altında gerçekten bulunmalı,
 *  - test sırasında aynı kategoriden iki soru yan yana gelmemeli,
 *  - çok maddeli görevlerin cevap anahtarı ezberlenebilir bir desen taşımamalı.
 *
 * Son madde deneyimle eklendi: hem hız görevinde hem n-back görevinde cevaplar düzenli
 * aralıklarla dizilmişti ve deseni fark eden kişi soruya bakmadan doğru yapabiliyordu.
 */
import { access } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createJsonQuestionRepository, QUESTIONS_FILE_PATH } from "./repository";
import { findAdjacentSameCategory, getTestQuestions } from "@/lib/test/ordering";
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

  it("test sırasında aynı kategoriden iki soru yan yana gelmez", async () => {
    const ordered = getTestQuestions(await repo.getAll());
    expect(findAdjacentSameCategory(ordered), "Ardışık aynı kategori").toEqual([]);
  });

  it("hız görevlerinin cevap anahtarı düzenli bir desen izlemez", async () => {
    const questions = await repo.getAll();
    const desenliler: string[] = [];

    for (const question of questions) {
      if (question.type !== "speed_task") continue;
      const key = question.items.map((item) => item.correctOptionId);

      // 1, 2 ve 3 adımlık tekrar: "hep aynı", "bir aynı bir farklı" gibi diziler ezberlenebilir.
      for (const period of [1, 2, 3]) {
        if (key.length <= period) continue;
        const isPeriodic = key.every((value, index) => index < period || value === key[index - period]);
        if (isPeriodic) desenliler.push(`${question.id}: ${period} adımda tekrar eden anahtar`);
      }
    }

    expect(desenliler, "Ezberlenebilir cevap anahtarı").toEqual([]);
  });

  it("n-back görevlerinde eşleşmeler düzensiz aralıklarla dağılır", async () => {
    const questions = await repo.getAll();
    const sorunlar: string[] = [];

    for (const question of questions) {
      if (question.type !== "nback_task") continue;

      const targets = question.sequence.flatMap((item, index) =>
        index >= question.n && item === question.sequence[index - question.n] ? [index] : [],
      );
      if (targets.length < 3) {
        sorunlar.push(`${question.id}: eşleşme sayısı çok az (${targets.length})`);
        continue;
      }

      // Aralıklar tek bir değerden ibaretse görev ritimle çözülebilir hale gelir.
      const gaps = targets.slice(1).map((value, index) => value - targets[index]!);
      if (new Set(gaps).size < 2) {
        sorunlar.push(`${question.id}: eşleşmeler ${gaps[0]} adımda bir tekrar ediyor`);
      }
    }

    expect(sorunlar, "Ezberlenebilir eşleşme deseni").toEqual([]);
  });
});

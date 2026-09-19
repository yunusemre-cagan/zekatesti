/**
 * JSON repository testleri. Her test geçici bir klasörde kendi veri dosyasıyla çalışır;
 * gerçek `data/questions.json` dosyasına dokunulmaz.
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DuplicateQuestionIdError,
  QuestionDataError,
  QuestionNotFoundError,
  ReadOnlyRepositoryError,
} from "./errors";
import { createJsonQuestionRepository } from "./repository";
import type { Question } from "./schema";

function makeQuestion(id: string, overrides: Partial<Question> = {}): Question {
  return {
    id,
    type: "single_choice",
    category: "numeric_pattern",
    difficulty: 1,
    prompt: `Soru ${id}`,
    options: [
      { id: "a", text: "1" },
      { id: "b", text: "2" },
    ],
    correctOptionId: "a",
    active: true,
    ...overrides,
  } as Question;
}

let tempDir: string;
let filePath: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "iq-repo-test-"));
  filePath = path.join(tempDir, "questions.json");
  await writeFile(filePath, JSON.stringify([makeQuestion("q-1"), makeQuestion("q-2")]));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("createJsonQuestionRepository — okuma", () => {
  it("tüm soruları dosyadaki sırayla döner", async () => {
    const repo = createJsonQuestionRepository({ filePath, readOnly: true });
    const questions = await repo.getAll();
    expect(questions.map((q) => q.id)).toEqual(["q-1", "q-2"]);
  });

  it("kimliğe göre soru bulur, yoksa undefined döner", async () => {
    const repo = createJsonQuestionRepository({ filePath, readOnly: true });
    expect((await repo.getById("q-2"))?.id).toBe("q-2");
    expect(await repo.getById("yok")).toBeUndefined();
  });

  it("dosya yoksa QuestionDataError fırlatır", async () => {
    const repo = createJsonQuestionRepository({ filePath: path.join(tempDir, "yok.json"), readOnly: true });
    await expect(repo.getAll()).rejects.toBeInstanceOf(QuestionDataError);
  });

  it("geçersiz JSON'da QuestionDataError fırlatır", async () => {
    await writeFile(filePath, "{ bozuk");
    const repo = createJsonQuestionRepository({ filePath, readOnly: true });
    await expect(repo.getAll()).rejects.toBeInstanceOf(QuestionDataError);
  });

  it("şemaya uymayan veride hatanın yerini gösteren QuestionDataError fırlatır", async () => {
    await writeFile(filePath, JSON.stringify([{ ...makeQuestion("q-1"), correctOptionId: "z" }]));
    const repo = createJsonQuestionRepository({ filePath, readOnly: true });
    await expect(repo.getAll()).rejects.toThrow(/\[0\]\.correctOptionId/);
  });
});

describe("createJsonQuestionRepository — yazma", () => {
  it("yeni soruyu listenin sonuna ekler ve dosyaya kalıcı olarak yazar", async () => {
    const repo = createJsonQuestionRepository({ filePath, readOnly: false });
    await repo.create(makeQuestion("q-3"));

    const onDisk = JSON.parse(await readFile(filePath, "utf8")) as Question[];
    expect(onDisk.map((q) => q.id)).toEqual(["q-1", "q-2", "q-3"]);
  });

  it("var olan kimlikle eklemeyi DuplicateQuestionIdError ile reddeder", async () => {
    const repo = createJsonQuestionRepository({ filePath, readOnly: false });
    await expect(repo.create(makeQuestion("q-1"))).rejects.toBeInstanceOf(DuplicateQuestionIdError);
  });

  it("güncellemede sorunun listedeki yerini korur", async () => {
    const repo = createJsonQuestionRepository({ filePath, readOnly: false });
    await repo.update(makeQuestion("q-1", { prompt: "Güncellendi" }));

    const questions = await repo.getAll();
    expect(questions.map((q) => q.id)).toEqual(["q-1", "q-2"]);
    expect(questions[0]?.prompt).toBe("Güncellendi");
  });

  it("olmayan soruyu güncelleme/silmede QuestionNotFoundError fırlatır", async () => {
    const repo = createJsonQuestionRepository({ filePath, readOnly: false });
    await expect(repo.update(makeQuestion("yok"))).rejects.toBeInstanceOf(QuestionNotFoundError);
    await expect(repo.delete("yok")).rejects.toBeInstanceOf(QuestionNotFoundError);
  });

  it("soruyu siler", async () => {
    const repo = createJsonQuestionRepository({ filePath, readOnly: false });
    await repo.delete("q-1");
    expect((await repo.getAll()).map((q) => q.id)).toEqual(["q-2"]);
  });

  it("şemaya uymayan soruyu yazmaz ve dosyayı değiştirmez", async () => {
    const repo = createJsonQuestionRepository({ filePath, readOnly: false });
    const before = await readFile(filePath, "utf8");

    // Tip sistemini bilinçli olarak atlatıp geçersiz veri gönderiyoruz (ör. elle yazılmış hatalı istek).
    const invalid = { ...makeQuestion("q-3"), difficulty: 9 } as unknown as Question;
    await expect(repo.create(invalid)).rejects.toThrow();
    expect(await readFile(filePath, "utf8")).toBe(before);
  });

  it("eşzamanlı yazmalarda hiçbir değişikliği kaybetmez", async () => {
    const repo = createJsonQuestionRepository({ filePath, readOnly: false });
    await Promise.all(["a", "b", "c", "d", "e"].map((suffix) => repo.create(makeQuestion(`q-${suffix}`))));
    expect(await repo.getAll()).toHaveLength(7);
  });

  it("başarısız bir yazmadan sonra sonraki yazmalar çalışmaya devam eder", async () => {
    const repo = createJsonQuestionRepository({ filePath, readOnly: false });
    await expect(repo.create(makeQuestion("q-1"))).rejects.toThrow();
    await repo.create(makeQuestion("q-3"));
    expect(await repo.getAll()).toHaveLength(3);
  });

  it("salt-okunur modda tüm yazma işlemlerini ReadOnlyRepositoryError ile reddeder", async () => {
    const repo = createJsonQuestionRepository({ filePath, readOnly: true });
    await expect(repo.create(makeQuestion("q-3"))).rejects.toBeInstanceOf(ReadOnlyRepositoryError);
    await expect(repo.update(makeQuestion("q-1"))).rejects.toBeInstanceOf(ReadOnlyRepositoryError);
    await expect(repo.delete("q-1")).rejects.toBeInstanceOf(ReadOnlyRepositoryError);
  });
});

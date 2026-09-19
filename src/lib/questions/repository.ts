/**
 * Soru deposu (repository): soruların nerede ve nasıl saklandığını uygulamanın geri kalanından gizler.
 *
 * Uygulama yalnızca `QuestionRepository` arayüzünü bilir. Şu an tek implementasyon JSON dosyasıdır
 * (`data/questions.json`). İleride uzak bir veritabanına geçilirse yalnızca bu dosyaya yeni bir
 * implementasyon eklenip `questionRepository` örneği değiştirilir; API ve arayüz kodu değişmez.
 *
 * NOT: Bu modül `node:fs` kullandığı için yalnızca sunucu tarafında (API route'ları, Server
 * Component'ler) içe aktarılabilir. Bir istemci bileşeninden içe aktarılırsa build hata verir;
 * bu, doğru cevapların yanlışlıkla tarayıcıya sızmasını da engelleyen bir güvencedir.
 *
 * Kullanım: /api/test/* route'ları soruları buradan okur; admin paneli route'ları buradan yazar.
 */
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { IS_WRITE_ENABLED } from "@/lib/config";
import {
  DuplicateQuestionIdError,
  QuestionDataError,
  QuestionNotFoundError,
  ReadOnlyRepositoryError,
} from "./errors";
import { questionCollectionSchema, type Question } from "./schema";

export interface QuestionRepository {
  /** Tüm soruları (aktif + pasif) dosyadaki sırasıyla döner. */
  getAll(): Promise<Question[]>;
  /** Kimliğe göre soru döner; yoksa `undefined`. */
  getById(id: string): Promise<Question | undefined>;
  /** Yeni soru ekler. Aynı kimlik varsa `DuplicateQuestionIdError` fırlatır. */
  create(question: Question): Promise<void>;
  /** Mevcut soruyu günceller (kimlik değiştirilemez). Yoksa `QuestionNotFoundError` fırlatır. */
  update(question: Question): Promise<void>;
  /** Soruyu siler. Yoksa `QuestionNotFoundError` fırlatır. */
  delete(id: string): Promise<void>;
}

export interface JsonQuestionRepositoryOptions {
  /** JSON veri dosyasının mutlak yolu. */
  filePath: string;
  /** `true` ise tüm yazma işlemleri `ReadOnlyRepositoryError` fırlatır. */
  readOnly: boolean;
}

/**
 * JSON dosyası tabanlı repository oluşturur.
 *
 * Tasarım kararları:
 * - Önbellek yok: Dosya küçüktür ve her okumada diskten okumak, admin panelinde yapılan
 *   değişikliklerin test ekranına anında yansımasını garanti eder.
 * - Her okuma ve yazmada tüm koleksiyon şemaya göre doğrulanır; bozuk veri ne okunabilir
 *   ne de dosyaya yazılabilir.
 * - Yazmalar sıraya alınır (aynı anda iki kayıt birbirinin değişikliğini ezmesin diye) ve
 *   önce geçici dosyaya yazılıp sonra yeniden adlandırılır (yazma yarıda kesilirse asıl
 *   dosya bozulmasın diye).
 */
export function createJsonQuestionRepository({
  filePath,
  readOnly,
}: JsonQuestionRepositoryOptions): QuestionRepository {
  /** Yazma işlemlerini sırayla çalıştırmak için kullanılan zincir. */
  let writeQueue: Promise<unknown> = Promise.resolve();

  async function readCollection(): Promise<Question[]> {
    let raw: string;
    try {
      raw = await readFile(filePath, "utf8");
    } catch (error) {
      throw new QuestionDataError(`Soru dosyası okunamadı: ${filePath}`, { cause: error });
    }

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch (error) {
      throw new QuestionDataError(`Soru dosyası geçerli bir JSON değil: ${filePath}`, {
        cause: error,
      });
    }

    const result = questionCollectionSchema.safeParse(json);
    if (!result.success) {
      throw new QuestionDataError(
        `Soru dosyası şemaya uymuyor: ${filePath}\n${formatIssues(result.error.issues)}`,
        { cause: result.error },
      );
    }
    return result.data;
  }

  async function writeCollection(questions: Question[]): Promise<void> {
    // Kaydetmeden önce de doğrula: çağıran taraf doğrulamayı unutsa bile dosya bozulmaz.
    const validated = questionCollectionSchema.parse(questions);
    const tempPath = `${filePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
    await rename(tempPath, filePath);
  }

  /**
   * Oku → değiştir → yaz döngüsünü kuyrukta, diğer yazmalarla çakışmadan çalıştırır.
   * `mutate` fonksiyonu mevcut listeyi alır ve yeni listeyi döner.
   */
  function mutate(mutateFn: (questions: Question[]) => Question[]): Promise<void> {
    if (readOnly) {
      return Promise.reject(new ReadOnlyRepositoryError());
    }
    const task = writeQueue.then(async () => {
      const current = await readCollection();
      await writeCollection(mutateFn(current));
    });
    // Bir yazma başarısız olsa bile sonraki yazmalar çalışabilsin diye hata kuyrukta yutulur;
    // hata çağırana `task` üzerinden iletilir.
    writeQueue = task.catch(() => undefined);
    return task;
  }

  return {
    getAll: readCollection,

    async getById(id) {
      const questions = await readCollection();
      return questions.find((q) => q.id === id);
    },

    create(question) {
      return mutate((questions) => {
        if (questions.some((q) => q.id === question.id)) {
          throw new DuplicateQuestionIdError(question.id);
        }
        return [...questions, question];
      });
    },

    update(question) {
      return mutate((questions) => {
        const index = questions.findIndex((q) => q.id === question.id);
        if (index === -1) {
          throw new QuestionNotFoundError(question.id);
        }
        // Sorunun listedeki yeri korunur; böylece git diff'i yalnızca değişen soruyu gösterir.
        return questions.with(index, question);
      });
    },

    delete(id) {
      return mutate((questions) => {
        if (!questions.some((q) => q.id === id)) {
          throw new QuestionNotFoundError(id);
        }
        return questions.filter((q) => q.id !== id);
      });
    },
  };
}

/** Zod hatalarını okunabilir, satır satır bir metne çevirir (ör. "[3].options: En az 2 şık olmalı."). */
function formatIssues(issues: readonly { path: PropertyKey[]; message: string }[]): string {
  return issues
    .map((issue) => {
      const location = issue.path
        .map((key) => (typeof key === "number" ? `[${key}]` : `.${String(key)}`))
        .join("")
        .replace(/^\./, "");
      return `  - ${location || "(kök)"}: ${issue.message}`;
    })
    .join("\n");
}

/** Varsayılan veri dosyası yolu. Vercel paketine dahil edilmesi next.config.ts içinde sağlanır. */
export const QUESTIONS_FILE_PATH = path.join(process.cwd(), "data", "questions.json");

/** Uygulama genelinde kullanılan repository örneği. */
export const questionRepository: QuestionRepository = createJsonQuestionRepository({
  filePath: QUESTIONS_FILE_PATH,
  readOnly: !IS_WRITE_ENABLED,
});

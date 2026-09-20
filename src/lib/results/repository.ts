/**
 * Test sonuçlarının saklanması ve istatistiklerin hesaplanması.
 *
 * İki uygulama vardır ve ortam değişkenine göre seçilir:
 *  - Postgres (production): `POSTGRES_URL` tanımlıysa kullanılır. Standart Postgres istemcisi
 *    (`pg`) ile bağlanır; bu sayede Prisma Postgres, Vercel Postgres, Supabase gibi tüm
 *    Postgres uyumlu servislerle aynı kod çalışır.
 *  - JSON dosyası (yalnızca yerel geliştirme): Veritabanı tanımlı değilken akışın uçtan uca
 *    denenebilmesi için `data/results.json` dosyasına yazar. Bu dosya git'e girmez.
 *
 * Veritabanı yoksa ve ortam production ise sonuçlar saklanmaz; uygulama çalışmaya devam eder,
 * yalnızca istatistik özelliği kapalı kalır (bkz. `isResultStorageEnabled`).
 *
 * Kullanım: /api/results (kayıt) ve /api/stats (istatistik) route'ları.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import type {
  Demographics,
  OverallStats,
  QuestionStats,
  StoredQuestionResult,
  StoredResult,
  StoredResultSummary,
  TestStats,
} from "./schema";

export interface SaveResultInput extends StoredResultSummary {
  id: string;
  participantId: string;
  demographics: Demographics;
  questions: StoredQuestionResult[];
}

export interface ResultsRepository {
  /** Sonucu kaydeder. Aynı kimlikle ikinci kez çağrılırsa yeni kayıt oluşturmaz. */
  save(input: SaveResultInput): Promise<void>;
  /** Genel ortalamalar ve soru bazlı istatistikler. */
  getStats(): Promise<TestStats>;
}

const JSON_FILE_PATH = path.join(process.cwd(), "data", "results.json");

/** Sonuç saklama açık mı? Kapalıysa arayüzde onay formu gösterilmez. */
export function isResultStorageEnabled(): boolean {
  return process.env.POSTGRES_URL !== undefined || process.env.NODE_ENV === "development";
}

// ---------------------------------------------------------------------------
// Ortak hesaplamalar
// ---------------------------------------------------------------------------

/**
 * Kayıtlardan istatistikleri hesaplar.
 *
 * Aynı katılımcının birden fazla denemesi varsa yalnızca **ilk denemesi** sayılır; aksi
 * halde testi tekrar tekrar çözen bir kişi ortalamaları kendi yönüne çeker.
 */
function computeStats(results: readonly StoredResult[]): TestStats {
  const firstAttempts = [...results]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .filter((result, index, all) => all.findIndex((r) => r.participantId === result.participantId) === index);

  const overall: OverallStats = {
    participantCount: firstAttempts.length,
    averageIq: average(firstAttempts.map((r) => r.estimatedIq)),
    averageAccuracyRatio: average(firstAttempts.map((r) => r.accuracyRatio)),
    averageTotalSeconds: average(firstAttempts.map((r) => r.totalSeconds)),
  };

  const byQuestion = new Map<string, { correct: number; total: number; seconds: number }>();
  for (const result of firstAttempts) {
    for (const question of result.questions) {
      const entry = byQuestion.get(question.questionId) ?? { correct: 0, total: 0, seconds: 0 };
      entry.total += 1;
      entry.seconds += question.seconds;
      if (question.status === "correct") entry.correct += 1;
      byQuestion.set(question.questionId, entry);
    }
  }

  const questions: QuestionStats[] = [...byQuestion.entries()].map(([questionId, entry]) => ({
    questionId,
    answerCount: entry.total,
    correctRatio: entry.total === 0 ? 0 : entry.correct / entry.total,
    averageSeconds: entry.total === 0 ? 0 : entry.seconds / entry.total,
  }));

  return { overall, questions };
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// ---------------------------------------------------------------------------
// JSON dosyası (yalnızca yerel geliştirme)
// ---------------------------------------------------------------------------

/**
 * Dosya tabanlı depo. Vercel'de dosya sistemi kalıcı olmadığı için yalnızca geliştirmede
 * kullanılır; amacı, veritabanı bağlanmadan önce akışın denenebilmesidir.
 */
export function createJsonResultsRepository(filePath = JSON_FILE_PATH): ResultsRepository {
  let writeQueue: Promise<unknown> = Promise.resolve();

  async function readAll(): Promise<StoredResult[]> {
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as (Omit<StoredResult, "createdAt"> & { createdAt: string })[];
      return parsed.map((result) => ({ ...result, createdAt: new Date(result.createdAt) }));
    } catch {
      // Dosya henüz yoksa boş liste döner.
      return [];
    }
  }

  return {
    save(input) {
      const task = writeQueue.then(async () => {
        const results = await readAll();
        if (results.some((result) => result.id === input.id)) return;

        results.push({ ...input, createdAt: new Date() });
        await writeFile(filePath, `${JSON.stringify(results, null, 2)}\n`, "utf8");
      });
      writeQueue = task.catch(() => undefined);
      return task;
    },

    async getStats() {
      return computeStats(await readAll());
    },
  };
}

// ---------------------------------------------------------------------------
// Postgres (production)
// ---------------------------------------------------------------------------

/**
 * Postgres tabanlı depo.
 *
 * İstatistikler tek tek satırları çekmek yerine veritabanında toplanır (GROUP BY);
 * katılımcı sayısı arttıkça da hızlı kalır.
 *
 * Bağlantı havuzu modül düzeyinde bir kez kurulur. Sunucusuz ortamda aynı örnek birden fazla
 * isteğe hizmet ettiği için havuz yeniden kullanılır; `max: 3` ile de veritabanının bağlantı
 * sınırı zorlanmaz.
 */
export function createPostgresResultsRepository(connectionString: string): ResultsRepository {
  const pool = new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  return {
    async save(input) {
      // İki tabloya yazılır; biri yazılıp diğeri yazılmadan kalmasın diye tek işlemde yapılır.
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO test_results (
             id, participant_id, estimated_iq, accuracy_ratio, score_ratio,
             total_seconds, question_count, correct_count, birth_year, gender, province_code
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (id) DO NOTHING`,
          [
            input.id,
            input.participantId,
            input.estimatedIq,
            input.accuracyRatio,
            input.scoreRatio,
            input.totalSeconds,
            input.questionCount,
            input.correctCount,
            input.demographics.birthYear ?? null,
            input.demographics.gender ?? null,
            input.demographics.provinceCode ?? null,
          ],
        );
        // jsonb_to_recordset sütun adlarını JSON anahtarlarıyla birebir eşler; bu yüzden
        // alan adları JSON'daki gibi (camelCase) ve tırnak içinde yazılır.
        await client.query(
          `INSERT INTO question_results (result_id, question_id, status, score, seconds)
           SELECT $1, q."questionId", q.status, q.score, q.seconds
           FROM jsonb_to_recordset($2::jsonb)
             AS q("questionId" text, status text, score real, seconds int)
           ON CONFLICT (result_id, question_id) DO NOTHING`,
          [input.id, JSON.stringify(input.questions)],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async getStats() {
      /**
       * `first_attempts`: her katılımcının yalnızca ilk sonucu. Tekrar çözenler
       * ortalamaları bozmasın diye istatistikler bu küme üzerinden hesaplanır.
       */
      const [overallResult, questionResult] = await Promise.all([
        pool.query(`
          WITH first_attempts AS (
            SELECT DISTINCT ON (participant_id) *
            FROM test_results
            ORDER BY participant_id, created_at ASC
          )
          SELECT
            COUNT(*)::int AS participant_count,
            COALESCE(AVG(estimated_iq), 0)::float AS average_iq,
            COALESCE(AVG(accuracy_ratio), 0)::float AS average_accuracy_ratio,
            COALESCE(AVG(total_seconds), 0)::float AS average_total_seconds
          FROM first_attempts
        `),
        pool.query(`
          WITH first_attempts AS (
            SELECT DISTINCT ON (participant_id) id
            FROM test_results
            ORDER BY participant_id, created_at ASC
          )
          SELECT
            qr.question_id,
            COUNT(*)::int AS answer_count,
            AVG(CASE WHEN qr.status = 'correct' THEN 1.0 ELSE 0.0 END)::float AS correct_ratio,
            AVG(qr.seconds)::float AS average_seconds
          FROM question_results qr
          JOIN first_attempts fa ON fa.id = qr.result_id
          GROUP BY qr.question_id
        `),
      ]);

      const overallRow = overallResult.rows[0] as
        | {
            participant_count: number;
            average_iq: number;
            average_accuracy_ratio: number;
            average_total_seconds: number;
          }
        | undefined;

      return {
        overall: {
          participantCount: overallRow?.participant_count ?? 0,
          averageIq: overallRow?.average_iq ?? 0,
          averageAccuracyRatio: overallRow?.average_accuracy_ratio ?? 0,
          averageTotalSeconds: overallRow?.average_total_seconds ?? 0,
        },
        questions: (
          questionResult.rows as {
            question_id: string;
            answer_count: number;
            correct_ratio: number;
            average_seconds: number;
          }[]
        ).map((row) => ({
          questionId: row.question_id,
          answerCount: row.answer_count,
          correctRatio: row.correct_ratio,
          averageSeconds: row.average_seconds,
        })),
      };
    },
  };
}

/**
 * Uygulamanın kullandığı depo: `POSTGRES_URL` varsa Postgres, yoksa (yerelde) JSON dosyası.
 */
export const resultsRepository: ResultsRepository =
  process.env.POSTGRES_URL !== undefined
    ? createPostgresResultsRepository(process.env.POSTGRES_URL)
    : createJsonResultsRepository();

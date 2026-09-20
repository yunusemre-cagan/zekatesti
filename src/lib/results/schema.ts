/**
 * Kaydedilen test sonuçlarının ve isteğe bağlı katılımcı bilgilerinin şeması.
 *
 * Katılımcıdan hiçbir kimlik bilgisi (ad, e-posta, IP) istenmez ve saklanmaz. Yalnızca
 * kullanıcı açıkça onay verirse, kendi girdiği üç alan (doğum yılı, cinsiyet, il) sonuca
 * eklenir; üçü de boş bırakılabilir.
 *
 * Kullanım: /api/results route'u gelen isteği bununla doğrular; results/repository.ts
 * kayıtları bu tiplerle okur ve yazar.
 */
import { z } from "zod";
import { isValidProvinceCode } from "@/lib/demographics/provinces";

/** Cinsiyet seçenekleri. "Belirtmek istemiyorum" da geçerli bir cevaptır. */
export const GENDERS = ["kadin", "erkek", "belirtilmemis"] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<Gender, string> = {
  kadin: "Kadın",
  erkek: "Erkek",
  belirtilmemis: "Belirtmek istemiyorum",
};

/** Kabul edilen doğum yılı aralığı. Gün ve ay sorulmaz; yalnızca yıl yeterlidir. */
export const MIN_BIRTH_YEAR = 1930;
export const MAX_BIRTH_YEAR = new Date().getFullYear() - 6;

/** Kullanıcının isteğe bağlı olarak girdiği bilgiler. Üçü de boş bırakılabilir. */
export const demographicsSchema = z.object({
  birthYear: z.int().min(MIN_BIRTH_YEAR).max(MAX_BIRTH_YEAR).optional(),
  gender: z.enum(GENDERS).optional(),
  provinceCode: z
    .int()
    .refine(isValidProvinceCode, { message: "Geçersiz il kodu." })
    .optional(),
});

export type Demographics = z.infer<typeof demographicsSchema>;

/**
 * Kaydedilmiş bir sonucun özeti. `signedResult` içinden gelir; istemcinin gönderdiği
 * sayılara güvenilmez (bkz. results/token.ts).
 */
export interface StoredResultSummary {
  estimatedIq: number;
  accuracyRatio: number;
  scoreRatio: number;
  totalSeconds: number;
  questionCount: number;
  correctCount: number;
}

/** Kaydedilmiş sonuçtaki tek bir sorunun sonucu. İstatistikler bunlardan hesaplanır. */
export interface StoredQuestionResult {
  questionId: string;
  status: "correct" | "partial" | "wrong" | "unanswered";
  score: number;
  seconds: number;
}

/** Veritabanına yazılacak tam kayıt. */
export interface StoredResult extends StoredResultSummary {
  id: string;
  /** Tarayıcıda saklanan rastgele kimlik; aynı kişinin tekrar denemelerini ayırmak için. */
  participantId: string;
  createdAt: Date;
  demographics: Demographics;
  questions: StoredQuestionResult[];
}

// ---------------------------------------------------------------------------
// İstatistikler
// ---------------------------------------------------------------------------

/** Tüm katılımcılar üzerinden genel ortalamalar. */
export interface OverallStats {
  participantCount: number;
  averageIq: number;
  averageAccuracyRatio: number;
  averageTotalSeconds: number;
}

/** Tek bir sorunun istatistiği. */
export interface QuestionStats {
  questionId: string;
  answerCount: number;
  /** Tam doğru yapanların oranı (0–1). */
  correctRatio: number;
  /** Soruda harcanan ortalama süre (saniye). */
  averageSeconds: number;
}

export interface TestStats {
  overall: OverallStats;
  questions: QuestionStats[];
}

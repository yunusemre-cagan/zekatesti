/**
 * Tüm testi puanlar ve sonuç ekranında gösterilecek özeti üretir.
 *
 * Ağırlıklandırma: Her soru, zorluğu (1/2/3) kadar puan değerindedir. Zor sorular sonuca
 * daha çok etki eder. Kısmi puanlı sorularda (hız görevi) alınan puan da aynı ağırlıkla çarpılır.
 *
 * Cevaplanmayan sorular 0 puan alır; teste giren her soru toplam puana (paydaya) dahildir.
 *
 * Kullanım: /api/test/submit route'u tarafından çağrılır; ürettiği sonuç sonuç ekranında gösterilir.
 */
import { TEST_DURATION_SEC } from "@/lib/config";
import { QUESTION_CATEGORIES, type Question, type QuestionCategory } from "@/lib/questions/schema";
import type { AnswerMap } from "@/lib/test/answers";
import { evaluateAnswer, type AnswerStatus } from "./check-answer";
import { estimateIq, iqToPercentile } from "./iq";

export interface QuestionOutcome {
  questionId: string;
  category: QuestionCategory;
  status: AnswerStatus;
  /** 0–1 arası ham puan. */
  score: number;
  /** Sonuç ekranında gösterilen çözüm açıklaması. */
  explanation?: string;
}

export interface CategoryResult {
  category: QuestionCategory;
  questionCount: number;
  /** Kategoride alınan ağırlıklı puan. */
  earned: number;
  /** Kategoride alınabilecek en yüksek ağırlıklı puan. */
  max: number;
  /** earned / max (0–1). */
  ratio: number;
}

export interface TestResult {
  estimatedIq: number;
  /** Nüfusun yüzde kaçından yüksek (1–99). */
  percentile: number;
  totalQuestions: number;
  /** Tam puan alınan soru sayısı. */
  correctCount: number;
  /** Ağırlıklı başarı oranı (0–1). */
  scoreRatio: number;
  elapsedSec: number;
  /** Yalnızca testte sorusu bulunan kategoriler, QUESTION_CATEGORIES sırasıyla. */
  categories: CategoryResult[];
  /** Soruların test sırasıyla tek tek sonuçları. */
  questions: QuestionOutcome[];
}

/**
 * Testi puanlar.
 *
 * @param questions Teste giren sorular (test sırasıyla). Cevap anahtarını içerir; yalnızca sunucuda çağrılmalıdır.
 * @param answers   Soru kimliği → kullanıcı cevabı. Testte olmayan sorulara ait cevaplar yok sayılır.
 * @param elapsedSec İstemcinin bildirdiği geçen süre; [0, TEST_DURATION_SEC] aralığına sınırlanır.
 */
export function scoreTest(
  questions: readonly Question[],
  answers: AnswerMap,
  elapsedSec: number,
): TestResult {
  const outcomes: QuestionOutcome[] = [];
  const categoryTotals = new Map<QuestionCategory, { count: number; earned: number; max: number }>();
  let earnedTotal = 0;
  let maxTotal = 0;

  for (const question of questions) {
    // `Object.hasOwn` ile kontrol, "__proto__" gibi kimliklerin prototipten okunmasını engeller.
    const answer = Object.hasOwn(answers, question.id) ? answers[question.id] : undefined;
    const { score, status } = evaluateAnswer(question, answer);
    const weight = question.difficulty;

    earnedTotal += score * weight;
    maxTotal += weight;

    const totals = categoryTotals.get(question.category) ?? { count: 0, earned: 0, max: 0 };
    totals.count += 1;
    totals.earned += score * weight;
    totals.max += weight;
    categoryTotals.set(question.category, totals);

    outcomes.push({
      questionId: question.id,
      category: question.category,
      status,
      score,
      ...(question.explanation !== undefined && { explanation: question.explanation }),
    });
  }

  const scoreRatio = maxTotal > 0 ? earnedTotal / maxTotal : 0;
  const estimatedIq = estimateIq(scoreRatio);

  return {
    estimatedIq,
    percentile: iqToPercentile(estimatedIq),
    totalQuestions: questions.length,
    correctCount: outcomes.filter((o) => o.status === "correct").length,
    scoreRatio,
    elapsedSec: Math.round(Math.min(Math.max(elapsedSec, 0), TEST_DURATION_SEC)),
    categories: QUESTION_CATEGORIES.flatMap((category) => {
      const totals = categoryTotals.get(category);
      if (totals === undefined) return [];
      return [
        {
          category,
          questionCount: totals.count,
          earned: totals.earned,
          max: totals.max,
          ratio: totals.earned / totals.max,
        },
      ];
    }),
    questions: outcomes,
  };
}

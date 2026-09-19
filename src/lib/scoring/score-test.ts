/**
 * Tüm testi puanlar ve sonuç ekranında gösterilecek özeti üretir.
 *
 * Puanlama iki bileşenden oluşur:
 *  1. Doğruluk: Cevabın 0–1 arası puanı (bkz. check-answer.ts).
 *  2. Hız: Soruda harcanan sürenin beklenen süreye oranından türeyen çarpan
 *     (bkz. speed-factor.ts). Yavaş çözülen doğru cevap daha az puan alır.
 *
 * Ağırlıklandırma: Her soru, zorluğu (1/2/3) kadar puan değerindedir; zor sorular sonuca
 * daha çok etki eder. Cevaplanmayan sorular 0 puan alır ve toplam puana (paydaya) dahildir.
 *
 * Kullanım: /api/test/submit route'u tarafından çağrılır; ürettiği sonuç sonuç ekranında gösterilir.
 */
import { QUESTION_CATEGORIES, type Question, type QuestionCategory } from "@/lib/questions/schema";
import type { AnswerMap, DurationMap } from "@/lib/test/answers";
import { evaluateAnswer, type AnswerStatus } from "./check-answer";
import { estimateIq, iqToPercentile } from "./iq";
import { capRecordedSec, getExpectedSec, getSpeedFactor } from "./speed-factor";

export interface QuestionOutcome {
  questionId: string;
  category: QuestionCategory;
  status: AnswerStatus;
  /** 0–1 arası doğruluk puanı (hız çarpanı uygulanmadan önce). */
  score: number;
  /** Soruda harcanan süre (saniye, üst sınırla kırpılmış). */
  seconds: number;
  /** Sorunun beklenen çözüm süresi (saniye). */
  expectedSec: number;
  /** Uygulanan hız çarpanı (0.5–1). Hız görevlerinde her zaman 1'dir. */
  speedFactor: number;
  /** Sonuç ekranında gösterilen çözüm açıklaması. */
  explanation?: string;
}

export interface CategoryResult {
  category: QuestionCategory;
  questionCount: number;
  /** Kategoride alınan ağırlıklı puan (hız çarpanı dahil). */
  earned: number;
  /** Kategoride alınabilecek en yüksek ağırlıklı puan. */
  max: number;
  /** earned / max (0–1). */
  ratio: number;
  /** Kategoride harcanan toplam süre (saniye). */
  seconds: number;
}

export interface TestResult {
  estimatedIq: number;
  /** Nüfusun yüzde kaçından yüksek (1–99). */
  percentile: number;
  totalQuestions: number;
  /** Doğruluk puanı tam olan soru sayısı (hız çarpanından bağımsız). */
  correctCount: number;
  /** Ağırlıklı ve hız çarpanı uygulanmış başarı oranı (0–1). */
  scoreRatio: number;
  /** Yalnızca doğruluktan gelen başarı oranı; hızın etkisini göstermek için. */
  accuracyRatio: number;
  /** Soru sürelerinin toplamı (saniye). */
  totalSeconds: number;
  /** Beklenenden yavaş çözülen (hız çarpanı 1'in altında kalan) soru sayısı. */
  slowQuestionCount: number;
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
 * @param durations Soru kimliği → harcanan süre (saniye). Eksik kayıtlar 0 kabul edilir.
 */
export function scoreTest(
  questions: readonly Question[],
  answers: AnswerMap,
  durations: DurationMap,
): TestResult {
  const outcomes: QuestionOutcome[] = [];
  const categoryTotals = new Map<
    QuestionCategory,
    { count: number; earned: number; max: number; seconds: number }
  >();
  let earnedTotal = 0;
  let accuracyTotal = 0;
  let maxTotal = 0;
  let totalSeconds = 0;

  for (const question of questions) {
    // `Object.hasOwn` ile kontrol, "constructor" gibi kimliklerin prototipten okunmasını engeller.
    const answer = Object.hasOwn(answers, question.id) ? answers[question.id] : undefined;
    const rawSeconds = Object.hasOwn(durations, question.id) ? durations[question.id] : undefined;
    // Gösterim için yuvarlanır; hız çarpanı ham değerden hesaplanır. Kategori toplamları da
    // bu yuvarlanmış değerden toplanır, böylece ekranda soru süreleri ile kategori süresi tutar.
    const seconds = Math.round(capRecordedSec(rawSeconds ?? 0));

    const { score, status } = evaluateAnswer(question, answer);
    const speedFactor = getSpeedFactor(question, rawSeconds);
    const weight = question.difficulty;

    earnedTotal += score * speedFactor * weight;
    accuracyTotal += score * weight;
    maxTotal += weight;
    totalSeconds += seconds;

    const totals = categoryTotals.get(question.category) ?? {
      count: 0,
      earned: 0,
      max: 0,
      seconds: 0,
    };
    totals.count += 1;
    totals.earned += score * speedFactor * weight;
    totals.max += weight;
    totals.seconds += seconds;
    categoryTotals.set(question.category, totals);

    outcomes.push({
      questionId: question.id,
      category: question.category,
      status,
      score,
      seconds,
      expectedSec: getExpectedSec(question),
      speedFactor,
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
    accuracyRatio: maxTotal > 0 ? accuracyTotal / maxTotal : 0,
    totalSeconds: Math.round(totalSeconds),
    // Yalnızca puan alan sorularda "yavaş" uyarısı anlamlıdır; boş bırakılan soru yavaş sayılmaz.
    slowQuestionCount: outcomes.filter((o) => o.speedFactor < 1 && o.score > 0).length,
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
          seconds: Math.round(totals.seconds),
        },
      ];
    }),
    questions: outcomes,
  };
}

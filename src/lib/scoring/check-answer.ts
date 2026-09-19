/**
 * Tek bir sorunun cevabını değerlendirir.
 *
 * Her soru 0 ile 1 arasında bir puan alır:
 *  - single_choice   : Doğru şık → 1, aksi → 0
 *  - multi_choice    : Seçilen küme doğru kümeyle birebir aynı → 1, aksi → 0.
 *                      Kısmi puan verilmez; aksi halde tüm şıkları işaretleyen kullanıcı
 *                      tahminle puan toplayabilirdi.
 *  - memory_sequence : Normalize edilmiş cevap, beklenen diziyle aynı → 1, aksi → 0
 *  - speed_task      : Doğru yapılan madde sayısı / toplam madde sayısı (kısmi puan)
 *
 * Tüm fonksiyonlar saftır (yan etkisizdir); aynı girdi her zaman aynı sonucu verir.
 */
import type {
  MemorySequenceQuestion,
  MultiChoiceQuestion,
  Question,
  SingleChoiceQuestion,
  SpeedTaskQuestion,
} from "@/lib/questions/schema";
import type {
  Answer,
  MemorySequenceAnswer,
  MultiChoiceAnswer,
  SingleChoiceAnswer,
  SpeedTaskAnswer,
} from "@/lib/test/answers";

/**
 * - correct    : Tam puan
 * - partial    : Kısmi puan (yalnızca hız görevlerinde)
 * - wrong      : Cevaplandı ama puan alamadı
 * - unanswered : Cevap yok veya cevap soru tipiyle uyuşmuyor
 */
export type AnswerStatus = "correct" | "partial" | "wrong" | "unanswered";

export interface AnswerEvaluation {
  /** 0 ile 1 arasında puan. */
  score: number;
  status: AnswerStatus;
}

const UNANSWERED: AnswerEvaluation = { score: 0, status: "unanswered" };

/**
 * Bir sorunun cevabını değerlendirir.
 * Cevap yoksa veya cevabın tipi soruyla uyuşmuyorsa (bozuk/elle hazırlanmış istek) "unanswered" döner.
 */
export function evaluateAnswer(question: Question, answer: Answer | undefined): AnswerEvaluation {
  if (answer === undefined) {
    return UNANSWERED;
  }

  // Her dalda hem soru hem cevap tipi kontrol edilir; böylece TypeScript ikisini birlikte
  // daraltır ve tip dönüşümüne (cast) gerek kalmaz.
  switch (question.type) {
    case "single_choice":
      return answer.type === "single_choice" ? toEvaluation(scoreSingleChoice(question, answer)) : UNANSWERED;
    case "multi_choice":
      return answer.type === "multi_choice" ? toEvaluation(scoreMultiChoice(question, answer)) : UNANSWERED;
    case "memory_sequence":
      return answer.type === "memory_sequence" ? toEvaluation(scoreMemory(question, answer)) : UNANSWERED;
    case "speed_task":
      return answer.type === "speed_task" ? toEvaluation(scoreSpeedTask(question, answer)) : UNANSWERED;
  }
}

/**
 * Bellek sorusunda beklenen cevabı diziden hesaplar (ör. 7-2-9 + "reverse" → "927").
 * Beklenen cevap veride ayrıca tutulmaz; böylece dizi ile cevap birbirinden kopamaz.
 */
export function getExpectedMemoryAnswer(question: MemorySequenceQuestion): string {
  const { sequence, transform } = question;
  switch (transform) {
    case "same":
      return sequence.join("");
    case "reverse":
      return sequence.toReversed().join("");
    case "sorted":
      // Öğeler tek karakterlik rakam/büyük harf olduğu için varsayılan sıralama doğru sonuç verir.
      return sequence.toSorted().join("");
  }
}

/**
 * Kullanıcının yazdığı bellek cevabını karşılaştırmaya hazırlar.
 * Kullanıcı "8 1 4", "8-1-4" veya "8,1,4" yazabilir; hepsi "814" olarak kabul edilir.
 * Büyük harfe çevirmede Türkçe yerel ayarı bilinçli olarak kullanılmaz: dizi öğeleri A–Z ile
 * sınırlıdır ve Türkçe ayarında "i" → "İ" olacağı için "I" ile eşleşmezdi.
 */
export function normalizeMemoryInput(value: string): string {
  return value.replace(/[^0-9a-z]/gi, "").toUpperCase();
}

// ---------------------------------------------------------------------------
// Tipe özel puanlayıcılar
// ---------------------------------------------------------------------------

function scoreSingleChoice(question: SingleChoiceQuestion, answer: SingleChoiceAnswer): number {
  return answer.optionId === question.correctOptionId ? 1 : 0;
}

function scoreMultiChoice(question: MultiChoiceQuestion, answer: MultiChoiceAnswer): number {
  const selected = new Set(answer.optionIds);
  const correct = new Set(question.correctOptionIds);
  const isExactMatch = selected.size === correct.size && [...correct].every((id) => selected.has(id));
  return isExactMatch ? 1 : 0;
}

function scoreMemory(question: MemorySequenceQuestion, answer: MemorySequenceAnswer): number {
  return normalizeMemoryInput(answer.value) === getExpectedMemoryAnswer(question) ? 1 : 0;
}

function scoreSpeedTask(question: SpeedTaskQuestion, answer: SpeedTaskAnswer): number {
  const correctCount = question.items.filter(
    (item) => answer.responses[item.id] === item.correctOptionId,
  ).length;
  return correctCount / question.items.length;
}

function toEvaluation(score: number): AnswerEvaluation {
  if (score >= 1) return { score: 1, status: "correct" };
  if (score > 0) return { score, status: "partial" };
  return { score: 0, status: "wrong" };
}

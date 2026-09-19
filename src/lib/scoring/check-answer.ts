/**
 * Tek bir sorunun cevabını değerlendirir.
 *
 * Her soru 0 ile 1 arasında bir puan alır:
 *  - single_choice   : Doğru şık → 1, aksi → 0
 *  - multi_choice    : Kısmi puanlı, şans düzeltmeli (aşağıya bakınız)
 *  - memory_sequence : Normalize edilmiş cevap, beklenen diziyle aynı → 1, aksi → 0
 *  - speed_task      : Kısmi puanlı, şans düzeltmeli (aşağıya bakınız)
 *
 * ŞANS DÜZELTMESİ (kısmi puanlı sorularda): Yanlış işaretlemeler puan düşürür; böylece
 * rastgele/garantici işaretlemenin beklenen puanı sıfır olur ve kullanıcı emin olmadığı
 * maddeyi boş bırakmaya (yani düşünmeye) yönelir. Boş bırakmak ne kazandırır ne kaybettirir.
 * Puan asla 0'ın altına düşmez; bir soruda yapılan hatalar başka bir sorunun puanını götürmez.
 *
 * Tüm fonksiyonlar saftır (yan etkisizdir); aynı girdi her zaman aynı sonucu verir.
 *
 * Kullanım: score-test.ts her soru için bu modülü çağırır. Doğrudan API veya arayüz tarafından çağrılmaz.
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

/**
 * Çoklu seçim: (doğru işaretler − yanlış işaretler × ceza) / doğru şık sayısı
 *
 * Ceza katsayısı "doğru şık sayısı / yanlış şık sayısı" seçilir. Bunun sonucu şudur:
 * tüm şıkları işaretleyen kullanıcı tam olarak 0 alır, dolayısıyla garantici işaretleme
 * hiçbir avantaj sağlamaz. Buna karşılık iki doğrudan birini bulan kullanıcı 0.5 alır.
 */
function scoreMultiChoice(question: MultiChoiceQuestion, answer: MultiChoiceAnswer): number {
  const correctIds = new Set(question.correctOptionIds);
  // Tekrar eden işaretler tek sayılır; soruda bulunmayan şık kimlikleri yok sayılır.
  const selectedIds = new Set(
    answer.optionIds.filter((id) => question.options.some((option) => option.id === id)),
  );

  const correctCount = [...selectedIds].filter((id) => correctIds.has(id)).length;
  const wrongCount = selectedIds.size - correctCount;
  const incorrectOptionCount = question.options.length - correctIds.size;

  // Tüm şıkların doğru olduğu (yanlış şıkkı bulunmayan) soruda ceza uygulanamaz.
  const penaltyPerWrong = incorrectOptionCount > 0 ? correctIds.size / incorrectOptionCount : 0;
  return clampScore((correctCount - wrongCount * penaltyPerWrong) / correctIds.size);
}

function scoreMemory(question: MemorySequenceQuestion, answer: MemorySequenceAnswer): number {
  return normalizeMemoryInput(answer.value) === getExpectedMemoryAnswer(question) ? 1 : 0;
}

/**
 * Hız görevi: (doğru maddeler − yanlış maddeler × ceza) / toplam madde sayısı
 *
 * Ceza katsayısı "1 / (şık sayısı − 1)" seçilir. 5 şıklı bir görevde rastgele işaretleyen
 * kullanıcı ortalama 5 maddede 1 doğru, 4 yanlış yapar ve beklenen puanı 0 olur.
 * Cevaplanmayan maddeler ne kazandırır ne kaybettirir.
 */
function scoreSpeedTask(question: SpeedTaskQuestion, answer: SpeedTaskAnswer): number {
  let correctCount = 0;
  let wrongCount = 0;

  for (const item of question.items) {
    const response = Object.hasOwn(answer.responses, item.id) ? answer.responses[item.id] : undefined;
    // Cevapsız maddeler ve görevde bulunmayan şık kimlikleri yok sayılır (çoklu seçimdeki gibi).
    if (response === undefined || !question.options.some((option) => option.id === response)) continue;
    if (response === item.correctOptionId) correctCount += 1;
    else wrongCount += 1;
  }

  const penaltyPerWrong = question.options.length > 1 ? 1 / (question.options.length - 1) : 0;
  return clampScore((correctCount - wrongCount * penaltyPerWrong) / question.items.length);
}

/** Puanı 0–1 aralığına sınırlar (ceza nedeniyle negatife düşen puanlar 0 kabul edilir). */
function clampScore(score: number): number {
  return Math.min(Math.max(score, 0), 1);
}

function toEvaluation(score: number): AnswerEvaluation {
  if (score >= 1) return { score: 1, status: "correct" };
  if (score > 0) return { score, status: "partial" };
  return { score: 0, status: "wrong" };
}

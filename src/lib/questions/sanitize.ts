/**
 * Soruları istemciye (tarayıcıya) gönderilebilir hale getirir.
 *
 * Doğru cevaplar (`correctOptionId`, `correctOptionIds`, maddelerin `correctOptionId`'si) ve
 * çözüm açıklamaları tarayıcıya ASLA gönderilmez; aksi halde geliştirici araçlarıyla cevaplar
 * görülebilirdi. Puanlama bu nedenle tamamen sunucuda yapılır.
 *
 * Güvenlik kararı — beyaz liste yaklaşımı: Nesne kopyalanıp gizli alanlar silinmez; bunun
 * yerine gönderilecek alanlar tek tek seçilir. Böylece şemaya ileride yeni bir gizli alan
 * eklenirse, burada açıkça eklenmedikçe istemciye sızmaz.
 *
 * Bilinen istisna: Bellek sorusunda dizi (`sequence`) kullanıcıya gösterilmek zorunda olduğu
 * için istemciye gönderilir. Bu, testin doğası gereği kaçınılmazdır.
 */
import type {
  MemorySequenceQuestion,
  MultiChoiceQuestion,
  Question,
  QuestionCategory,
  SingleChoiceQuestion,
  SpeedTaskQuestion,
} from "./schema";

/** Tüm istemci sorularında ortak alanlar. */
interface PublicQuestionBase {
  id: string;
  category: QuestionCategory;
  prompt: string;
  promptImage?: string;
}

export interface PublicSingleChoiceQuestion extends PublicQuestionBase {
  type: "single_choice";
  options: SingleChoiceQuestion["options"];
}

export interface PublicMultiChoiceQuestion extends PublicQuestionBase {
  type: "multi_choice";
  options: MultiChoiceQuestion["options"];
}

export interface PublicMemorySequenceQuestion extends PublicQuestionBase {
  type: "memory_sequence";
  sequence: MemorySequenceQuestion["sequence"];
  itemDisplayMs: number;
  transform: MemorySequenceQuestion["transform"];
}

export interface PublicSpeedTaskQuestion extends PublicQuestionBase {
  type: "speed_task";
  timeLimitSec: number;
  legend?: SpeedTaskQuestion["legend"];
  options: SpeedTaskQuestion["options"];
  items: { id: string; stimulus: SpeedTaskQuestion["items"][number]["stimulus"] }[];
}

/** İstemciye gönderilen, cevap içermeyen soru. */
export type PublicQuestion =
  | PublicSingleChoiceQuestion
  | PublicMultiChoiceQuestion
  | PublicMemorySequenceQuestion
  | PublicSpeedTaskQuestion;

/** Bir soruyu, doğru cevap ve açıklama içermeyen istemci sürümüne dönüştürür. */
export function toPublicQuestion(question: Question): PublicQuestion {
  const base: PublicQuestionBase = {
    id: question.id,
    category: question.category,
    prompt: question.prompt,
    ...(question.promptImage !== undefined && { promptImage: question.promptImage }),
  };

  switch (question.type) {
    case "single_choice":
      return { ...base, type: "single_choice", options: question.options };

    case "multi_choice":
      return { ...base, type: "multi_choice", options: question.options };

    case "memory_sequence":
      return {
        ...base,
        type: "memory_sequence",
        sequence: question.sequence,
        itemDisplayMs: question.itemDisplayMs,
        transform: question.transform,
      };

    case "speed_task":
      return {
        ...base,
        type: "speed_task",
        timeLimitSec: question.timeLimitSec,
        ...(question.legend !== undefined && { legend: question.legend }),
        options: question.options,
        items: question.items.map((item) => ({ id: item.id, stimulus: item.stimulus })),
      };
  }
}

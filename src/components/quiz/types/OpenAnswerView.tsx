/**
 * Açık uçlu sorunun arayüzü: şık yoktur, kullanıcı cevabı yazar.
 *
 * Doğru cevap istemciye hiç gönderilmez (bkz. lib/questions/sanitize.ts); karşılaştırma
 * sunucuda, normalize edilerek yapılır. Bu yüzden kullanıcıya biçim serbestliği tanınır:
 * sayılarda boşluk/binlik ayracı, metinlerde büyük-küçük harf farkı sorun çıkarmaz.
 *
 * Kullanım: QuestionRenderer, soru tipi "open_answer" olduğunda bunu kullanır.
 */
"use client";

import type { PublicOpenAnswerQuestion } from "@/lib/questions/sanitize";
import type { OpenAnswerAnswer } from "@/lib/test/answers";

export interface OpenAnswerViewProps {
  question: PublicOpenAnswerQuestion;
  answer: OpenAnswerAnswer | undefined;
  onAnswer: (answer: OpenAnswerAnswer) => void;
}

export function OpenAnswerView({ question, answer, onAnswer }: OpenAnswerViewProps) {
  const isNumeric = question.answerFormat === "number";

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="open-answer" className="text-sm text-zinc-600 dark:text-zinc-400">
        Cevabınızı yazın. {isNumeric ? "Yalnızca sayı girin." : "Büyük-küçük harf fark etmez."}
      </label>
      <input
        id="open-answer"
        type="text"
        // Sayısal cevaplarda mobil klavye sayı düzeniyle açılır; tip "text" bırakılır ki
        // tarayıcının sayı alanına özgü ok tuşları ve biçim kısıtları devreye girmesin.
        inputMode={isNumeric ? "decimal" : "text"}
        autoComplete="off"
        value={answer?.value ?? ""}
        onChange={(event) => onAnswer({ type: "open_answer", value: event.target.value })}
        placeholder={question.placeholder ?? (isNumeric ? "Örn: 42" : "Cevabınız")}
        className="rounded-lg border border-zinc-300 p-3 text-lg dark:border-zinc-700 dark:bg-transparent"
      />
      <p className="text-sm text-zinc-500">
        Bu soruda şık yoktur; tahmin etmek yerine emin olduğunuz cevabı yazın.
      </p>
    </div>
  );
}

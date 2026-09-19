/**
 * Birden fazla doğru şıklı soruların arayüzü (ör. "hangileri aynı cismin döndürülmüş hali?").
 * Şıka tıklamak seçimi açar/kapatır.
 *
 * Kullanıcı uyarılır: yanlış işaretler puan düşürdüğü için (bkz. lib/scoring/check-answer.ts)
 * emin olunmayan şıkkı işaretlememek daha iyidir.
 *
 * Kullanım: QuestionRenderer, soru tipi "multi_choice" olduğunda bunu kullanır.
 */
"use client";

import type { PublicMultiChoiceQuestion } from "@/lib/questions/sanitize";
import type { MultiChoiceAnswer } from "@/lib/test/answers";
import { OptionButton } from "../OptionButton";

export interface MultiChoiceViewProps {
  question: PublicMultiChoiceQuestion;
  answer: MultiChoiceAnswer | undefined;
  onAnswer: (answer: MultiChoiceAnswer) => void;
}

export function MultiChoiceView({ question, answer, onAnswer }: MultiChoiceViewProps) {
  const selectedIds = answer?.optionIds ?? [];

  const toggle = (optionId: string) => {
    const next = selectedIds.includes(optionId)
      ? selectedIds.filter((id) => id !== optionId)
      : [...selectedIds, optionId];
    onAnswer({ type: "multi_choice", optionIds: next });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-500">
        Birden fazla şık işaretleyebilirsiniz. Yanlış işaretler puan düşürür.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {question.options.map((option) => (
          <OptionButton
            key={option.id}
            option={option}
            isSelected={selectedIds.includes(option.id)}
            onSelect={() => toggle(option.id)}
          />
        ))}
      </div>
    </div>
  );
}

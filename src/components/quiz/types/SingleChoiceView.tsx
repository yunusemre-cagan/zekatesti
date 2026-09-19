/**
 * Tek doğru şıklı soruların arayüzü (sayısal örüntü, matris, mantık, analoji, problem çözme...).
 * Yeni bir şıkka tıklamak önceki seçimin yerini alır.
 *
 * Kullanım: QuestionRenderer, soru tipi "single_choice" olduğunda bunu kullanır.
 */
"use client";

import type { PublicSingleChoiceQuestion } from "@/lib/questions/sanitize";
import type { SingleChoiceAnswer } from "@/lib/test/answers";
import { OptionButton } from "../OptionButton";

export interface SingleChoiceViewProps {
  question: PublicSingleChoiceQuestion;
  answer: SingleChoiceAnswer | undefined;
  onAnswer: (answer: SingleChoiceAnswer) => void;
}

export function SingleChoiceView({ question, answer, onAnswer }: SingleChoiceViewProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {question.options.map((option) => (
        <OptionButton
          key={option.id}
          option={option}
          isSelected={answer?.optionId === option.id}
          onSelect={() => onAnswer({ type: "single_choice", optionId: option.id })}
        />
      ))}
    </div>
  );
}

/**
 * Soruyu tipine göre doğru bileşene yönlendirir ve ortak kısmı (metin, görsel) çizer.
 *
 * Cevap tipi ile soru tipi burada eşleştirilir: her dalda cevabın tipi kontrol edilerek
 * alt bileşene yalnızca kendi tipindeki cevap verilir.
 *
 * Kullanım: TestRunner, ekrandaki soruyu bu bileşenle çizer.
 */
"use client";

import type { PublicQuestion } from "@/lib/questions/sanitize";
import type { Answer } from "@/lib/test/answers";
import { MemorySequenceView } from "./types/MemorySequenceView";
import { NbackView } from "./types/NbackView";
import { OpenAnswerView } from "./types/OpenAnswerView";
import { MultiChoiceView } from "./types/MultiChoiceView";
import { SingleChoiceView } from "./types/SingleChoiceView";
import { SpeedTaskView } from "./types/SpeedTaskView";

export interface QuestionRendererProps {
  question: PublicQuestion;
  answer: Answer | undefined;
  onAnswer: (answer: Answer) => void;
  /** Bellek/hız görevlerinin başlangıç anı (ms); başlatılmadıysa `undefined`. */
  taskStartedAtMs: number | undefined;
  isTaskCompleted: boolean;
  onStartTask: () => void;
  onCompleteTask: () => void;
}

export function QuestionRenderer({
  question,
  answer,
  onAnswer,
  taskStartedAtMs,
  isTaskCompleted,
  onStartTask,
  onCompleteTask,
}: QuestionRendererProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        {/* Soru metni: veride satır sonu kullanılabildiği için whitespace korunur. */}
        <p className="text-lg whitespace-pre-line">{question.prompt}</p>
        {question.promptImage !== undefined && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={question.promptImage}
            alt=""
            className="max-h-72 w-auto self-center object-contain"
          />
        )}
      </div>

      {renderByType()}
    </div>
  );

  function renderByType() {
    switch (question.type) {
      case "single_choice":
        return (
          <SingleChoiceView
            question={question}
            answer={answer?.type === "single_choice" ? answer : undefined}
            onAnswer={onAnswer}
          />
        );

      case "multi_choice":
        return (
          <MultiChoiceView
            question={question}
            answer={answer?.type === "multi_choice" ? answer : undefined}
            onAnswer={onAnswer}
          />
        );

      case "open_answer":
        return (
          <OpenAnswerView
            question={question}
            answer={answer?.type === "open_answer" ? answer : undefined}
            onAnswer={onAnswer}
          />
        );

      case "nback_task":
        return (
          <NbackView
            question={question}
            answer={answer?.type === "nback_task" ? answer : undefined}
            onAnswer={onAnswer}
            isStarted={taskStartedAtMs !== undefined}
            isCompleted={isTaskCompleted}
            onStart={onStartTask}
            onComplete={onCompleteTask}
          />
        );

      case "memory_sequence":
        return (
          <MemorySequenceView
            question={question}
            answer={answer?.type === "memory_sequence" ? answer : undefined}
            onAnswer={onAnswer}
            isStarted={taskStartedAtMs !== undefined}
            isCompleted={isTaskCompleted}
            onStart={onStartTask}
            onComplete={onCompleteTask}
          />
        );

      case "speed_task":
        return (
          <SpeedTaskView
            question={question}
            answer={answer?.type === "speed_task" ? answer : undefined}
            onAnswer={onAnswer}
            startedAtMs={taskStartedAtMs}
            isCompleted={isTaskCompleted}
            onStart={onStartTask}
            onComplete={onCompleteTask}
          />
        );
    }
  }
}

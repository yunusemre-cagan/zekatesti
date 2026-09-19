/**
 * Tek bir şık butonu. Seçili durumu görsel olarak belirtir.
 *
 * Tek ve çoklu seçim soruları ile hız görevi aynı butonu kullanır; aradaki fark
 * yalnızca seçim davranışıdır ve üst bileşende yönetilir.
 *
 * Kullanım: SingleChoiceView, MultiChoiceView, SpeedTaskView.
 */
"use client";

import type { Option } from "@/lib/questions/schema";
import { MediaContent } from "./MediaContent";

export interface OptionButtonProps {
  option: Option;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

export function OptionButton({ option, isSelected, onSelect, disabled = false }: OptionButtonProps) {
  // Şık kimliği (a, b, c…) bir rozet olarak gösterilir. Hız görevlerinde kimlik ile metin
  // aynı olabildiği için (ör. "1"), böyle durumlarda rozet tekrar etmesin diye gizlenir.
  const showIdBadge = option.text !== option.id;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={isSelected}
      className={`flex min-h-14 items-center justify-center gap-3 rounded-lg border p-3 text-center transition-colors disabled:opacity-50 ${
        isSelected
          ? "border-foreground bg-foreground/10 font-medium"
          : "border-zinc-300 hover:border-foreground dark:border-zinc-700"
      }`}
    >
      {showIdBadge && <span className="text-sm text-zinc-500 uppercase">{option.id}</span>}
      <MediaContent media={option} />
    </button>
  );
}

"use client";

import { Check, X } from "lucide-react";
import { Blocks, EnlargeFigure } from "@/components/content/blocks";
import type { OptionKey, PublicQuestion, QuestionReveal } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Large tappable answer rows with radio semantics.
 * With a `reveal`, shows correct/incorrect state and locks the choice.
 */
export function OptionList({
  question,
  selected,
  reveal,
  disabled,
  still,
  onSelect,
}: {
  question: PublicQuestion;
  selected: OptionKey | null;
  reveal?: QuestionReveal | null;
  disabled?: boolean;
  /** No animation, for review. */
  still?: boolean;
  onSelect: (key: OptionKey) => void;
}) {
  const locked = !!reveal || disabled;

  return (
    <div role="radiogroup" aria-label="Answer options" className="space-y-2.5">
      {question.options.map((opt) => {
        const isSelected = selected === opt.key;
        const isCorrect = reveal?.correctOption === opt.key;
        const isWrongPick = !!reveal && isSelected && !isCorrect;
        const figure = opt.blocks.find((b) => b.type === "figure");

        return (
          <div key={opt.key} className="relative">
          <button
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-disabled={locked}
            onClick={() => !locked && onSelect(opt.key)}
            className={cn(
              "flex min-h-15 w-full items-center gap-3 rounded-2xl border-2 border-b-[5px] bg-card px-3 py-2.5 text-left text-base font-medium leading-snug transition",
              "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              !locked && "hover:border-primary/50 active:translate-y-[3px] active:border-b-2",
              isSelected && !reveal && "border-primary bg-secondary",
              isCorrect && "border-success bg-success-soft font-semibold", isCorrect && !still && "animate-pop",
              isWrongPick && "border-destructive bg-danger-soft", isWrongPick && !still && "animate-shake",
              reveal && !isCorrect && !isWrongPick && "opacity-60",
              locked && "cursor-default",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-xl bg-muted font-display text-base font-semibold",
                isSelected && !reveal && "bg-primary text-primary-foreground",
                isCorrect && "bg-success text-white",
                isWrongPick && "bg-destructive text-white",
              )}
            >
              {isCorrect ? <Check className="size-4" strokeWidth={3} /> : isWrongPick ? <X className="size-4" strokeWidth={3} /> : opt.key}
            </span>
            <Blocks blocks={opt.blocks} enlarge={false} className="flex-1" />
            {isCorrect && reveal ? <span className="sr-only">(correct answer)</span> : null}
            {isWrongPick ? <span className="sr-only">(your answer, incorrect)</span> : null}
          </button>
          {figure ? <EnlargeFigure block={figure} className="absolute top-1/2 right-3 -translate-y-1/2" /> : null}
          </div>
        );
      })}
    </div>
  );
}

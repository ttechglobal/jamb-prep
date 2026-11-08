"use client";

import { Check, ChevronDown, Minus, X as Cross } from "lucide-react";
import { useId, useState } from "react";
import { Blocks } from "@/components/content/blocks";
import { SolutionView } from "@/components/content/solution-view";
import type { OptionKey, QuestionReveal } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The answer card, shared by live practice and review so both read the same.
 * With `collapsible` it shows the verdict and one line until the student opens the full explanation.
 * The open/close button sits at the bottom of the explanation, directly above `children`, so it
 * stays in the same spot (under the thumb) whether the explanation is open or closed.
 * `children` stay visible below it, so actions never scroll out of reach.
 */
export function AnswerFeedback({
  reveal,
  selected,
  combo = 0,
  collapsible = false,
  className,
  children,
}: {
  reveal: QuestionReveal;
  selected: OptionKey | null;
  combo?: number;
  collapsible?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(!collapsible);
  const panelId = useId();
  const solution = reveal.solution;
  // The one line shown straight away. Some questions have no intro, but every one has an answer.
  const summary = solution?.intro?.length ? "intro" : "answer";
  const correct = selected === reveal.correctOption;
  const skipped = selected === null;
  const title = correct
    ? combo >= 3
      ? `${combo} in a row!`
      : "Correct!"
    : skipped
      ? `Skipped. The answer is ${reveal.correctOption}`
      : `The answer is ${reveal.correctOption}`;

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border-2 border-b-[6px] p-4",
        correct ? "border-success bg-success-soft" : skipped ? "border-border bg-card" : "border-destructive bg-danger-soft",
        className,
      )}
    >
      <div role="status" className="flex shrink-0 items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full text-white",
            correct ? "bg-success" : skipped ? "bg-muted-foreground" : "bg-destructive",
          )}
        >
          {correct ? (
            <Check className="size-6" strokeWidth={3.5} />
          ) : skipped ? (
            <Minus className="size-6" strokeWidth={3.5} />
          ) : (
            <Cross className="size-6" strokeWidth={3.5} />
          )}
        </span>
        <p
          className={cn(
            "min-w-0 flex-1 font-display text-xl font-semibold leading-tight",
            correct ? "text-primary-edge" : skipped ? "text-foreground" : "text-destructive-edge",
          )}
        >
          {title}
        </p>
      </div>

      {solution && collapsible ? <Blocks blocks={solution[summary]!} className="mt-2.5 shrink-0 text-[0.95rem] leading-relaxed" /> : null}

      {solution && open ? (
        <div id={panelId} className={cn("min-h-0", collapsible && "-mx-1 animate-rise overflow-y-auto px-1")}>
          <SolutionView solution={solution} selected={selected} omit={collapsible ? summary : undefined} />
        </div>
      ) : null}

      {solution && collapsible ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="mt-3 flex h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-background/70 text-sm font-semibold transition-colors hover:bg-background"
        >
          {open ? "Hide explanation" : "View full explanation"}
          <ChevronDown className={cn("size-4 transition-transform", !open && "rotate-180")} aria-hidden />
        </button>
      ) : null}

      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}

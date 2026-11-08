"use client";

import type { SessionQuestion } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Numbered grid for jumping between questions. Used in the mock exam and on desktop. */
export function QuestionNavigator({
  items,
  current,
  answered,
  flagged,
  onJump,
}: {
  items: SessionQuestion[];
  current: number;
  answered: Set<string>;
  flagged: Set<string>;
  onJump: (index: number) => void;
}) {
  return (
    <nav aria-label="Question navigator">
      <ol className="grid grid-cols-6 gap-1.5 sm:grid-cols-10 lg:grid-cols-6">
        {items.map((item, i) => {
          const id = item.question.id;
          const isAnswered = answered.has(id);
          const isFlagged = flagged.has(id);
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onJump(i)}
                aria-current={i === current ? "step" : undefined}
                aria-label={`Question ${item.position}${isAnswered ? ", answered" : ", not answered"}${isFlagged ? ", flagged" : ""}`}
                className={cn(
                  "relative grid aspect-square w-full place-items-center rounded-md border text-xs font-semibold tabular-nums transition",
                  "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  isAnswered ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
                  i === current && "ring-2 ring-brand-bright ring-offset-1",
                )}
              >
                {item.position}
                {isFlagged ? (
                  <span aria-hidden className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-warning ring-2 ring-background" />
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm bg-primary" aria-hidden /> Answered</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm border bg-card" aria-hidden /> Not answered</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-warning" aria-hidden /> Flagged</span>
      </div>
    </nav>
  );
}

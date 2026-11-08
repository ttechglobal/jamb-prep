"use client";

import { Flag } from "lucide-react";
import { Blocks } from "@/components/content/blocks";
import { SharedContextPanel } from "@/components/content/shared-context";
import { SubjectIcon } from "@/components/game/game-ui";
import { OptionList } from "@/components/session/option-list";
import { SUBJECTS } from "@/lib/catalog";
import { liftExcerpt } from "@/lib/content/excerpt";
import type { OptionKey, PublicQuestion, QuestionReveal } from "@/lib/types";

export function QuestionView({
  question,
  number,
  total,
  selected,
  reveal,
  disabled,
  still,
  onSelect,
  onReport,
}: {
  question: PublicQuestion;
  number: number;
  total: number;
  selected: OptionKey | null;
  reveal?: QuestionReveal | null;
  disabled?: boolean;
  still?: boolean;
  onSelect: (key: OptionKey) => void;
  onReport?: () => void;
}) {
  const subject = SUBJECTS.find((s) => s.id === question.subjectId)?.name;
  const topic = question.topicName;

  return (
    <article aria-labelledby={`q-${question.id}`}>
      <div className="flex items-center gap-2">
        <SubjectIcon id={question.subjectId} className="size-8 rounded-lg" iconClassName="size-4" />
        <div className="min-w-0 text-xs leading-tight">
          <p className="truncate font-semibold">{subject}</p>
          <p className="truncate text-muted-foreground">
            Question {number} of {total}
            {topic ? ` · ${topic}` : ""}
          </p>
        </div>
        {onReport ? (
          <button
            type="button"
            onClick={onReport}
            className="ml-auto inline-flex h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Flag className="size-3.5" aria-hidden /> Report
          </button>
        ) : null}
      </div>

      {question.instruction?.length ? (
        <Blocks blocks={question.instruction} className="mt-4 text-sm font-medium italic text-muted-foreground" />
      ) : null}

      {question.context ? (
        <div className="mt-3">
          <SharedContextPanel key={question.context.id} context={question.context} />
        </div>
      ) : null}

      <div
        role="heading"
        aria-level={2}
        id={`q-${question.id}`}
        className="mt-4 font-sans text-[1.15rem] font-semibold leading-relaxed text-pretty sm:text-xl"
      >
        <Blocks blocks={liftExcerpt(question.stem)} />
      </div>

      {question.work ? (
        <p className="mt-1.5 text-sm text-muted-foreground">
          <span className="italic">{question.work.title}</span>, {question.work.author}
          {question.work.reference ? ` · ${question.work.reference}` : ""}
        </p>
      ) : null}

      <div className="mt-5">
        <OptionList question={question} selected={selected} reveal={reveal} disabled={disabled} still={still} onSelect={onSelect} />
      </div>
    </article>
  );
}

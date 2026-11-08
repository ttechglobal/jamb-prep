"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Grid3x3, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Meter } from "@/components/game/game-ui";
import { AnswerFeedback } from "@/components/session/answer-feedback";
import { QuestionView } from "@/components/session/question-view";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SUBJECTS } from "@/lib/catalog";
import type { SessionResult } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = "all" | "missed";

/**
 * The standard way to review in every mode: back through the questions, one at a time.
 * A mock exam is reviewed one subject at a time, like the exam itself.
 */
export function AnswerReview({ result, initialSubject }: { result: SessionResult; initialSubject?: string | null }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [index, setIndex] = useState(0);
  const [navOpen, setNavOpen] = useState(false);

  const subjects = useMemo(() => (result.config.mode === "mock" ? result.bySubject : []), [result]);
  const [subjectId, setSubjectId] = useState<string | null>(
    () => subjects.find((s) => s.subjectId === initialSubject)?.subjectId ?? subjects[0]?.subjectId ?? null,
  );

  // Numbers count within the subject being reviewed, so "Question 7 of 45" matches the exam.
  const all = useMemo(() => {
    const scoped = subjectId ? result.review.filter((row) => row.question.subjectId === subjectId) : result.review;
    return scoped.map((row, i) => ({ ...row, number: i + 1 }));
  }, [result.review, subjectId]);
  const missed = useMemo(() => all.filter((row) => row.selected !== row.reveal.correctOption), [all]);
  const rows = filter === "all" ? all : missed;
  const row = rows[index];
  const isLast = index >= rows.length - 1;
  const resultsHref = `/session/${result.sessionId}/results`;

  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(rows.length - 1, i))), [rows.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (navOpen) return;
      if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, navOpen]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [index, filter]);

  function changeFilter(next: Filter) {
    setFilter(next);
    setIndex(0);
  }

  function changeSubject(next: string) {
    setSubjectId(next);
    setIndex(0);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 bg-background">
        <div className="mx-auto flex h-15 max-w-2xl items-center gap-2 px-2 sm:px-4">
          <Link href={resultsHref} aria-label="Back to results" className={buttonVariants({ variant: "ghost", size: "icon-lg" })}>
            <X aria-hidden className="size-5!" />
          </Link>
          <Meter
            percent={rows.length ? ((index + 1) / rows.length) * 100 : 0}
            label="Review progress"
            className="h-4 flex-1"
            barClassName="bg-brand-bright"
          />
          <span className="min-w-12 text-center font-display font-semibold tabular-nums">
            {rows.length ? index + 1 : 0}/{rows.length}
          </span>
          <Button variant="outline" size="icon-lg" aria-label="Jump to a question" onClick={() => setNavOpen(true)}>
            <Grid3x3 aria-hidden />
          </Button>
        </div>
        {subjects.length ? (
          <div role="tablist" aria-label="Subjects" className="mx-auto grid max-w-2xl grid-cols-4 gap-1.5 px-4 pb-2">
            {subjects.map((s) => {
              const active = s.subjectId === subjectId;
              return (
                <button
                  key={s.subjectId}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => changeSubject(s.subjectId)}
                  className={cn(
                    "min-w-0 rounded-lg border-2 px-1 py-1 text-xs font-semibold leading-tight transition",
                    active ? "border-brand-deep bg-brand-deep text-white" : "bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="block truncate">{SUBJECTS.find((x) => x.id === s.subjectId)?.shortName}</span>
                  <span className="block font-normal tabular-nums">
                    {s.correct}/{s.total}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
        <div className="mx-auto max-w-2xl px-4 pb-2">
          <div role="group" aria-label="Filter answers" className="grid grid-cols-2 rounded-xl bg-muted p-1">
            {(
              [
                ["all", `All (${all.length})`],
                ["missed", `Missed (${missed.length})`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => changeFilter(value)}
                className={cn(
                  "rounded-lg text-sm font-semibold text-muted-foreground transition aria-pressed:bg-card aria-pressed:text-foreground",
                  subjects.length ? "h-9" : "h-10",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-3">
        {row ? (
          <div className="space-y-4">
            <QuestionView
              question={row.question}
              number={row.number}
              total={all.length}
              selected={row.selected}
              reveal={row.reveal}
              still
              onSelect={() => {}}
            />
            <AnswerFeedback reveal={row.reveal} selected={row.selected} />
          </div>
        ) : (
          <div className="game-card mt-4 p-6 text-center">
            <p className="font-display text-xl font-semibold">Nothing missed</p>
            <p className="mt-1 text-sm text-muted-foreground">You got every question right.</p>
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 bg-background">
        <div className="mx-auto flex max-w-2xl gap-3 px-4 py-3">
          <Button variant="outline" size="xl" disabled={index === 0} onClick={() => go(index - 1)} aria-label="Previous question">
            <ArrowLeft aria-hidden />
          </Button>
          {isLast ? (
            <Link href={resultsHref} className={buttonVariants({ size: "xl", className: "flex-1" })}>
              Back to results
            </Link>
          ) : (
            <Button size="xl" className="flex-1" onClick={() => go(index + 1)}>
              Next
              <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
      </div>

      <Dialog open={navOpen} onOpenChange={setNavOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Jump to a question</DialogTitle>
          </DialogHeader>
          <ol className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
            {rows.map((r, i) => {
              const correct = r.selected === r.reveal.correctOption;
              const skipped = r.selected === null;
              return (
                <li key={r.question.id}>
                  <button
                    type="button"
                    aria-current={i === index ? "step" : undefined}
                    aria-label={`Question ${r.number}, ${correct ? "correct" : skipped ? "skipped" : "incorrect"}`}
                    onClick={() => {
                      go(i);
                      setNavOpen(false);
                    }}
                    className={cn(
                      "grid aspect-square w-full place-items-center rounded-lg text-sm font-semibold tabular-nums",
                      correct ? "bg-success-soft text-primary-edge" : skipped ? "bg-muted text-muted-foreground" : "bg-danger-soft text-destructive",
                      i === index && "ring-2 ring-foreground ring-offset-1",
                    )}
                  >
                    {r.number}
                  </button>
                </li>
              );
            })}
          </ol>
        </DialogContent>
      </Dialog>
    </div>
  );
}

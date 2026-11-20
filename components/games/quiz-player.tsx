"use client";

import { ArrowRight, Check, RotateCcw, X as Cross } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Confetti, Stars } from "@/components/game/game-ui";
import { buttonVariants } from "@/components/ui/button";
import {
  ITEMS_PER_LEVEL,
  ITEMS_PER_ROUND,
  MIXED_ID,
  ROUNDS_PER_LEVEL,
  drawItems,
  levelOf,
  quizStars,
  type QuizGame,
} from "@/lib/games/quiz/games";
import { cn } from "@/lib/utils";

type Stage = "intro" | "play" | "roundEnd" | "done";

export function QuizPlayer({
  game,
  levelId,
  onFinish,
  onAgain,
}: {
  game: QuizGame;
  levelId: string;
  onFinish: (stars: number, correct: number) => void;
  onAgain: () => void;
}) {
  const isMixed = levelId === MIXED_ID;
  const level = levelOf(game, levelId);
  const back = `/games/play/${game.id}`;
  const [items] = useState(() => drawItems(game, levelId));
  const [stage, setStage] = useState<Stage>(isMixed ? "play" : "intro");
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [marks, setMarks] = useState<boolean[]>([]);

  const item = items[index];
  const correctCount = marks.filter(Boolean).length;
  const round = Math.floor(index / ITEMS_PER_ROUND);
  const roundCorrect = marks.slice(round * ITEMS_PER_ROUND, (round + 1) * ITEMS_PER_ROUND).filter(Boolean).length;
  const answered = picked !== null;
  const right = picked === item?.answer;
  const last = index + 1 >= items.length;
  const endsRound = (index + 1) % ITEMS_PER_ROUND === 0;

  function choose(word: string) {
    if (picked !== null || !item) return;
    setPicked(word);
    setMarks((m) => [...m, word === item.answer]);
  }

  function next() {
    if (last) {
      onFinish(quizStars(correctCount, items.length || ITEMS_PER_LEVEL), correctCount);
      setStage("done");
    } else if (endsRound) {
      setStage("roundEnd");
    } else {
      setIndex(index + 1);
      setPicked(null);
    }
  }

  if (!item && stage !== "done") return null;

  if (stage === "intro" && level) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 animate-rise">
        <Link href={back} className="inline-flex h-11 w-fit items-center gap-1.5 rounded-xl px-2 font-semibold text-muted-foreground hover:text-foreground">
          <Cross className="size-5" aria-hidden />
          Levels
        </Link>
        <section className="game-card p-5 sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            Level {game.levels.findIndex((l) => l.id === level.id) + 1}
          </p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight sm:text-4xl">{level.title}</h1>
          <p className="mt-2 text-lg leading-snug text-muted-foreground">{level.question}</p>
          <ul className="mt-4 space-y-2">
            {level.rule.map((line) => (
              <li key={line} className="flex gap-2.5 rounded-xl bg-secondary px-3.5 py-2.5 font-medium text-secondary-foreground">
                <Check className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={3} aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>
        <button type="button" autoFocus onClick={() => setStage("play")} className={buttonVariants({ size: "xl", className: "w-full" })}>
          Start
          <ArrowRight aria-hidden />
        </button>
        <p className="text-center text-sm text-muted-foreground">
          {ROUNDS_PER_LEVEL} rounds, {ITEMS_PER_ROUND} questions each.
        </p>
      </div>
    );
  }

  if (stage === "roundEnd") {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 animate-rise">
        <ProgressTop back={back} marks={marks} index={index} total={items.length} />
        <section className="game-card p-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Round {round + 1} done</p>
          <p className="mt-2 font-display text-5xl font-semibold">
            {roundCorrect}
            <span className="text-2xl text-muted-foreground"> / {ITEMS_PER_ROUND}</span>
          </p>
          <p className="mt-2 text-lg text-muted-foreground">
            {roundCorrect === ITEMS_PER_ROUND ? "Perfect round!" : roundCorrect >= 3 ? "Good going. Keep it up." : "Keep going. The rule will stick."}
          </p>
        </section>
        <button
          type="button"
          autoFocus
          onClick={() => {
            setIndex(index + 1);
            setPicked(null);
            setStage("play");
          }}
          className={buttonVariants({ size: "xl", className: "w-full" })}
        >
          Round {round + 2}
          <ArrowRight aria-hidden />
        </button>
      </div>
    );
  }

  if (stage === "done") {
    const total = items.length || ITEMS_PER_LEVEL;
    const stars = quizStars(correctCount, total);
    const at = game.levels.findIndex((l) => l.id === levelId);
    const nextLevel = !isMixed && stars >= 1 ? game.levels[at + 1] : undefined;
    const message =
      stars === 3
        ? "Brilliant! You have this one."
        : stars === 2
          ? "Strong work. One more go for three stars?"
          : stars === 1
            ? "Level cleared. Play again to sharpen it."
            : "Not cleared yet. Read the rule and try again.";
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 text-center animate-rise">
        {stars >= 2 ? <Confetti /> : null}
        <section className="game-card px-5 pb-6 pt-8">
          <Stars count={stars} />
          <h1 className="mt-4 text-3xl font-semibold">{isMixed ? "Mixed done" : level?.title}</h1>
          <p className="mt-1 font-display text-5xl font-semibold">
            {correctCount}
            <span className="text-2xl text-muted-foreground"> / {total}</span>
          </p>
          <p className="mt-2 text-lg text-muted-foreground">{message}</p>
        </section>
        {nextLevel ? (
          <Link href={`${back}/${nextLevel.id}`} className={buttonVariants({ size: "xl", className: "w-full" })}>
            Next: {nextLevel.title}
            <ArrowRight aria-hidden />
          </Link>
        ) : null}
        <button type="button" onClick={onAgain} className={buttonVariants({ variant: nextLevel ? "outline" : "default", size: "xl", className: "w-full" })}>
          <RotateCcw aria-hidden />
          Play again
        </button>
        <Link href={back} className={buttonVariants({ variant: "ghost", size: "lg", className: "w-full" })}>
          Back to levels
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <ProgressTop back={back} marks={marks} index={index} total={items.length} />

      <div className="game-card px-4 py-7 text-center sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{game.label}</p>
        <p className="mt-3 font-display text-2xl font-semibold leading-snug sm:text-3xl">{item.text}</p>
      </div>

      <ul className="grid gap-3">
        {item.options.map((opt) => {
          const isAnswer = opt === item.answer;
          const isPicked = picked === opt;
          return (
            <li key={opt}>
              <button
                type="button"
                disabled={answered}
                onClick={() => choose(opt)}
                className={cn(
                  "game-card flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left font-display text-xl font-semibold",
                  "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  !answered && "game-tap",
                  answered && isAnswer && "border-success bg-success-soft",
                  answered && isPicked && !isAnswer && "border-destructive bg-danger-soft",
                  answered && !isAnswer && !isPicked && "opacity-60",
                )}
              >
                <span>{opt}</span>
                {answered && isAnswer ? <Check aria-hidden className="size-6 shrink-0 text-success" strokeWidth={3.5} /> : null}
                {answered && isPicked && !isAnswer ? <Cross aria-hidden className="size-6 shrink-0 text-destructive" strokeWidth={3.5} /> : null}
              </button>
            </li>
          );
        })}
      </ul>

      {answered ? (
        <div className={cn("animate-rise rounded-2xl border-2 border-b-[6px] p-4", right ? "border-success bg-success-soft" : "border-destructive bg-danger-soft")}>
          <p role="status" className={cn("font-display text-xl font-semibold leading-tight", right ? "text-primary-edge" : "text-destructive-edge")}>
            {right ? "Correct!" : `Not quite. The answer is "${item.answer}".`}
          </p>
          <p className="mt-1.5 leading-snug text-muted-foreground">{item.why}</p>
          <button
            type="button"
            autoFocus
            onClick={next}
            className={buttonVariants({ variant: right ? "default" : "coral", size: "lg", className: "mt-3 w-full" })}
          >
            {last ? "See my stars" : endsRound ? "Finish round" : "Continue"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ProgressTop({ back, marks, index, total }: { back: string; marks: boolean[]; index: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      <Link href={back} aria-label="Leave and go back to levels" className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground">
        <Cross className="size-6" aria-hidden />
      </Link>
      <div role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={marks.length} className="flex flex-1 items-center gap-2">
        {Array.from({ length: Math.ceil(total / ITEMS_PER_ROUND) }, (_, r) => (
          <div key={r} className="flex flex-1 gap-1">
            {Array.from({ length: ITEMS_PER_ROUND }, (_, i) => {
              const n = r * ITEMS_PER_ROUND + i;
              return (
                <span
                  key={i}
                  className={cn(
                    "h-2.5 flex-1 rounded-full transition-colors",
                    n < marks.length ? (marks[n] ? "bg-success" : "bg-destructive") : n === index ? "bg-primary/40" : "bg-muted",
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

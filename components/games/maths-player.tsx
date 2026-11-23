"use client";

import { ArrowRight, Check, RotateCcw, X as Cross } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { Blocks } from "@/components/content/blocks";
import { Confetti, Stars } from "@/components/game/game-ui";
import { buttonVariants } from "@/components/ui/button";
import {
  MATHS_LEVELS,
  checkAnswer,
  drawItems,
  levelById,
  sameBuild,
  sameLines,
  type Gap,
  type Item,
} from "@/lib/games/maths/engine";
import { quizStars } from "@/lib/games/quiz/games";
import { cn } from "@/lib/utils";

const MathRender = dynamic(() => import("@/components/content/math"), {
  loading: () => <span className="text-muted-foreground">…</span>,
});

type Stage = "intro" | "play" | "done";

interface Outcome {
  right: boolean;
  /** What the student chose or built, kept to show beside the correct line when it was wrong. */
  said: string[];
}

export function MathsPlayer({
  topicId,
  topicName,
  levelId,
  back,
  onFinish,
  onAgain,
}: {
  topicId: string;
  topicName: string;
  levelId: string;
  back: string;
  onFinish: (stars: number, correct: number) => void;
  onAgain: () => void;
}) {
  const level = levelById(levelId);
  const [items] = useState<Item[]>(() => drawItems(topicId, levelId));
  const [stage, setStage] = useState<Stage>("intro");
  const [index, setIndex] = useState(0);
  // Which gap of the current puzzle is open, and how it went once answered.
  const [gapAt, setGapAt] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [done, setDone] = useState<Outcome[]>([]);
  const [marks, setMarks] = useState<boolean[]>([]);
  const [totals, setTotals] = useState({ right: 0, gaps: 0 });

  const item = items[index];

  function answer(o: Outcome) {
    if (outcome) return;
    setOutcome(o);
    setTotals((t) => ({ right: t.right + (o.right ? 1 : 0), gaps: t.gaps + 1 }));
  }

  function next() {
    if (!item || !outcome) return;
    const history = [...done, outcome];
    if (gapAt + 1 < item.gaps.length) {
      setDone(history);
      setGapAt(gapAt + 1);
      setOutcome(null);
      return;
    }
    const allRight = history.every((h) => h.right);
    setMarks((m) => [...m, allRight]);
    if (index + 1 >= items.length) {
      onFinish(quizStars(totals.right, totals.gaps), totals.right);
      setStage("done");
      return;
    }
    setIndex(index + 1);
    setGapAt(0);
    setOutcome(null);
    setDone([]);
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl p-6 text-center">
        <p className="text-lg text-muted-foreground">No working is ready for this topic yet.</p>
        <Link href={back} className={buttonVariants({ className: "mt-4" })}>
          Back
        </Link>
      </div>
    );
  }

  if (stage === "intro" && level) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 animate-rise">
        <Link href={back} className="inline-flex h-11 w-fit items-center gap-1.5 rounded-xl px-2 font-semibold text-muted-foreground hover:text-foreground">
          <Cross className="size-5" aria-hidden />
          Levels
        </Link>
        <section className="game-card p-5 sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            Level {MATHS_LEVELS.findIndex((l) => l.id === level.id) + 1} · {topicName}
          </p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight sm:text-4xl">{level.title}</h1>
          <p className="mt-2 text-lg leading-snug text-muted-foreground">{level.blurb}</p>
          <p className="mt-4 flex gap-2.5 rounded-xl bg-secondary px-3.5 py-2.5 font-medium text-secondary-foreground">
            <Check className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={3} aria-hidden />
            <span>{level.lesson}</span>
          </p>
        </section>
        <button type="button" autoFocus onClick={() => setStage("play")} className={buttonVariants({ size: "xl", className: "w-full" })}>
          Start
          <ArrowRight aria-hidden />
        </button>
        <p className="text-center text-sm text-muted-foreground">{items.length} questions. Nothing is shown past a gap until you answer it.</p>
      </div>
    );
  }

  if (stage === "done") {
    const stars = quizStars(totals.right, totals.gaps);
    const at = MATHS_LEVELS.findIndex((l) => l.id === levelId);
    const nextLevel = stars >= 1 ? MATHS_LEVELS[at + 1] : undefined;
    const message =
      stars === 3
        ? "Brilliant! You can carry the working yourself."
        : stars === 2
          ? "Strong work. One more go for three stars?"
          : stars === 1
            ? "Level cleared. Play again to sharpen it."
            : "Not cleared yet. Read each heading and try again.";
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 text-center animate-rise">
        {stars >= 2 ? <Confetti /> : null}
        <section className="game-card px-5 pb-6 pt-8">
          <Stars count={stars} />
          <h1 className="mt-4 text-3xl font-semibold">{level?.title}</h1>
          <p className="mt-1 font-display text-5xl font-semibold">
            {totals.right}
            <span className="text-2xl text-muted-foreground"> / {totals.gaps}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">gaps filled correctly</p>
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

  if (!item) return null;
  const gap = item.gaps[gapAt];
  const lastGap = gapAt === item.gaps.length - 1;
  // Nothing past the open gap is shown. Once the last gap is answered, the rest of the working appears.
  // A "solve it" gap shows no working at all until it is answered.
  const limit = outcome && lastGap ? item.puzzle.steps.length - 1 : gap.mode === "answer" ? -1 : gap.step;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href={back} aria-label="Leave and go back to levels" className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground">
          <Cross className="size-6" aria-hidden />
        </Link>
        <div role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={marks.length} className="flex flex-1 gap-1">
          {items.map((_, n) => (
            <span
              key={n}
              className={cn("h-2.5 flex-1 rounded-full transition-colors", n < marks.length ? (marks[n] ? "bg-success" : "bg-destructive") : n === index ? "bg-primary/40" : "bg-muted")}
            />
          ))}
        </div>
      </div>

      <section className="game-card p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Question {index + 1}</p>
        <div className="mt-1.5 text-lg leading-snug">
          <Blocks blocks={item.puzzle.stem} enlarge={false} />
        </div>
      </section>

      <ol className="flex flex-col gap-2.5" aria-label="Working">
        {item.puzzle.steps.slice(0, limit + 1).map((step, i) => {
          const gi = item.gaps.findIndex((g) => g.step === i);
          const isOpen = gi === gapAt && !outcome;
          const finished = gi >= 0 && (gi < gapAt || (gi === gapAt && outcome));
          const result = gi < gapAt ? done[gi] : gi === gapAt ? outcome : null;
          if (isOpen) return null;
          return (
            <li key={i} className={cn("animate-rise rounded-2xl border-2 px-4 py-3", finished ? (result?.right ? "border-success bg-success-soft" : "border-destructive bg-danger-soft") : "border-border bg-card")}>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                {finished ? (
                  result?.right ? <Check aria-hidden className="size-4 text-success" strokeWidth={3.5} /> : <Cross aria-hidden className="size-4 text-destructive" strokeWidth={3.5} />
                ) : null}
                {step.title}
              </p>
              <Lines lines={step.lines} />
              {finished && result && !result.right ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  You had: <span className="text-foreground">{result.said.length ? <Lines lines={result.said} inline /> : "nothing"}</span>
                </p>
              ) : null}
            </li>
          );
        })}
        {!outcome ? (
          <li className="animate-rise">
            <GapSlot key={`${index}-${gapAt}`} gap={gap} title={item.showHeading ? item.puzzle.steps[gap.step].title : gap.mode === "answer" ? "What is the answer?" : null} onAnswer={answer} />
          </li>
        ) : null}
      </ol>

      {outcome ? (
        <div className={cn("animate-rise rounded-2xl border-2 border-b-[6px] p-4", outcome.right ? "border-success bg-success-soft" : "border-destructive bg-danger-soft")}>
          <p role="status" className={cn("font-display text-xl font-semibold leading-tight", outcome.right ? "text-primary-edge" : "text-destructive-edge")}>
            {outcome.right ? "Correct!" : "Not quite. The correct line is above."}
          </p>
          {!item.showHeading && gap.mode !== "answer" ? <p className="mt-1.5 leading-snug text-muted-foreground">The move was: {item.puzzle.steps[gap.step].title}.</p> : null}
          {!outcome.right && gap.explain ? <p className="mt-1.5 leading-snug text-muted-foreground">{gap.explain}</p> : null}
          <button type="button" autoFocus onClick={next} className={buttonVariants({ variant: outcome.right ? "default" : "coral", size: "lg", className: "mt-3 w-full" })}>
            {!lastGap ? "Continue the working" : index + 1 >= items.length ? "See my stars" : "Next question"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Lines({ lines, inline }: { lines: string[]; inline?: boolean }) {
  return (
    <span className={cn("block", inline && "inline")}>
      {lines.map((l, i) => (
        <span key={i} className="block max-w-full overflow-x-auto overflow-y-hidden py-1 text-xl">
          <MathRender tex={l} />
        </span>
      ))}
    </span>
  );
}

/** The open gap: pick a tile, or build the line from pieces. Answering is final, so there is no retry. */
function GapSlot({ gap, title, onAnswer }: { gap: Gap; title: string | null; onAnswer: (o: Outcome) => void }) {
  const [built, setBuilt] = useState<number[]>([]);
  const truth = gap.mode === "build" ? gap.pieces : [];
  const [typed, setTyped] = useState("");

  if (gap.mode === "answer") {
    const submit = () => {
      const text = typed.trim();
      if (!text) return;
      // Shown back as plain text, so nothing the student types is read as a formula.
      onAnswer({ right: checkAnswer(text, gap.answer[0]), said: [`\\text{${text.replace(/[\\{}%$#&_^~]/g, "")}}`] });
    };
    return (
      <form
        className="rounded-2xl border-2 border-dashed border-primary bg-secondary/50 px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="final-answer" className="text-sm font-semibold text-primary">
          {title}
        </label>
        <input
          id="final-answer"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Type your answer"
          className="mt-2 h-14 w-full rounded-xl border-2 border-border bg-card px-3 font-display text-2xl focus-visible:border-primary focus-visible:outline-none"
        />
        <button type="submit" disabled={!typed.trim()} className={buttonVariants({ size: "lg", className: "mt-3 w-full" })}>
          Check
        </button>
      </form>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-primary bg-secondary/50 px-4 py-3">
      <p className="text-sm font-semibold text-primary">{title ?? "What comes next?"}</p>
      {gap.mode === "pick" ? (
        <ul className="mt-2 grid gap-2.5">
          {gap.options.map((o, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => onAnswer({ right: sameLines(o, gap.answer), said: o })}
                className="game-card game-tap w-full px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Lines lines={o} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className="mt-2 flex min-h-14 flex-wrap items-center gap-1.5 rounded-xl border-2 border-border bg-card px-2.5 py-2" aria-label="Your line">
            {built.length === 0 ? <span className="text-muted-foreground">Tap pieces to build the line</span> : null}
            {built.map((p, n) => (
              <button
                key={n}
                type="button"
                aria-label="Remove this piece"
                onClick={() => setBuilt(built.filter((_, k) => k !== n))}
                className="grid min-h-10 min-w-10 place-items-center rounded-lg bg-secondary px-2 text-xl hover:bg-muted"
              >
                <MathRender tex={truth[p]} />
              </button>
            ))}
          </div>
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {gap.pieces.map((p, i) => (
              <li key={i}>
                <button
                  type="button"
                  disabled={built.includes(i)}
                  onClick={() => setBuilt([...built, i])}
                  className={cn("game-card game-tap grid min-h-12 min-w-12 place-items-center px-3 text-xl", built.includes(i) && "opacity-30")}
                >
                  <MathRender tex={p} />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={built.length === 0}
            onClick={() => {
              const said = built.map((p) => truth[p]);
              onAnswer({ right: sameBuild(said, gap.answer[0]), said: [said.join(" ")] });
            }}
            className={buttonVariants({ size: "lg", className: "mt-3 w-full" })}
          >
            Check
          </button>
        </>
      )}
    </div>
  );
}

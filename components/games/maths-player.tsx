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
  mathsStars,
  matchesSlip,
  rightForFirstStar,
  sameBuild,
  sameLines,
  type Gap,
  type Item,
} from "@/lib/games/maths/engine";
import { cn } from "@/lib/utils";

const MathRender = dynamic(() => import("@/components/content/math"), {
  loading: () => <span className="text-muted-foreground">…</span>,
});

type Stage = "intro" | "play" | "done";

interface Outcome {
  right: boolean;
  /** What the student chose or built, kept to show beside the correct line when it was wrong. */
  said: string[];
  /** A plain sentence about what they did, for the games that have no single line to show. */
  note?: string;
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
  // How many lines after an answered gap have been shown so far. They come one at a time.
  const [extra, setExtra] = useState(0);
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
    setExtra(0);
    if (gapAt + 1 < item.gaps.length) {
      setDone(history);
      setGapAt(gapAt + 1);
      setOutcome(null);
      return;
    }
    const allRight = history.every((h) => h.right);
    setMarks((m) => [...m, allRight]);
    if (index + 1 >= items.length) {
      onFinish(mathsStars(totals.right, totals.gaps), totals.right);
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
      <div className="mx-auto flex max-w-xl flex-col gap-4 pt-2 animate-rise">
        <Link href={back} className="inline-flex h-11 w-fit items-center gap-1.5 rounded-xl px-2 font-semibold text-muted-foreground hover:text-foreground">
          <Cross className="size-5" aria-hidden />
          Levels
        </Link>
        <section className="game-card p-5 sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            Level {MATHS_LEVELS.findIndex((l) => l.id === level.id) + 1} of {MATHS_LEVELS.length} · {topicName}
          </p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight sm:text-4xl">{level.title}</h1>
          <p className="mt-2 text-lg leading-snug">{level.blurb}</p>
          <p className="mt-4 flex gap-2.5 rounded-xl bg-secondary px-3.5 py-2.5 font-medium text-secondary-foreground">
            <Check className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={3} aria-hidden />
            <span>{level.lesson}</span>
          </p>
        </section>
        <button type="button" autoFocus onClick={() => setStage("play")} className={buttonVariants({ size: "xl", className: "w-full" })}>
          Start
          <ArrowRight aria-hidden />
        </button>
        <p className="text-center text-sm text-muted-foreground">
          {items.length} questions. Get {rightForFirstStar(items.length)} right to earn a star. Nothing is shown past a gap until you answer it.
        </p>
      </div>
    );
  }

  if (stage === "done") {
    const stars = mathsStars(totals.right, totals.gaps);
    const at = MATHS_LEVELS.findIndex((l) => l.id === levelId);
    const nextLevel = stars >= 1 ? MATHS_LEVELS[at + 1] : undefined;
    const finishedTopic = stars >= 1 && !nextLevel;
    const need = rightForFirstStar(totals.gaps);
    const message =
      stars === 3
        ? "Perfect! You have this one."
        : stars === 2
          ? "Strong work. Get every one right for three stars."
          : stars === 1
            ? "Level cleared. Play it again for more stars, or move on."
            : `You needed ${need} right to earn a star. Read the headings and try again.`;
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 pt-4 text-center animate-rise">
        {stars >= 2 ? <Confetti /> : null}
        <section className="game-card px-5 pb-6 pt-8">
          <Stars count={stars} />
          <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-primary">{level?.title}</p>
          <p className="mt-1 font-display text-5xl font-semibold">
            {totals.right}
            <span className="text-2xl text-muted-foreground"> / {totals.gaps}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">right</p>
          <p className="mt-3 text-lg leading-snug">{message}</p>
        </section>

        {nextLevel ? (
          <Link href={`${back}/${nextLevel.id}`} className={buttonVariants({ size: "xl", className: "w-full" })}>
            Next level: {nextLevel.title}
            <ArrowRight aria-hidden />
          </Link>
        ) : finishedTopic ? (
          <>
            <p className="rounded-xl bg-secondary px-3.5 py-2.5 font-medium text-secondary-foreground">You have been through every level of {topicName}. Pick your next topic.</p>
            <Link href="/games/maths" className={buttonVariants({ size: "xl", className: "w-full" })}>
              Choose another topic
              <ArrowRight aria-hidden />
            </Link>
          </>
        ) : (
          <button type="button" onClick={onAgain} className={buttonVariants({ size: "xl", className: "w-full" })}>
            <RotateCcw aria-hidden />
            Try again
          </button>
        )}
        {stars >= 1 ? (
          <button type="button" onClick={onAgain} className={buttonVariants({ variant: "outline", size: "lg", className: "w-full" })}>
            <RotateCcw aria-hidden />
            Play this level again
          </button>
        ) : null}
        <Link href={back} className={buttonVariants({ variant: "ghost", size: "lg", className: "w-full" })}>
          Back to levels
        </Link>
      </div>
    );
  }

  if (!item || !level) return null;
  const gap = item.gaps[gapAt];
  const lastGap = gapAt === item.gaps.length - 1;
  const n = item.puzzle.steps.length;
  const special = gap.mode === "order" || gap.mode === "why" || gap.mode === "spot";
  const title = item.puzzle.steps[gap.step].title;

  // Lines between this gap and the next one (or the end) come one at a time after the answer.
  const nextStop = lastGap ? n : item.gaps[gapAt + 1].step;
  const available = gap.mode === "answer" || special ? 0 : Math.max(0, nextStop - 1 - gap.step);
  const limit = gap.mode === "answer" ? (outcome ? n - 1 : -1) : outcome ? gap.step + extra : gap.step;
  const moreToShow = Boolean(outcome) && extra < available;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 pt-2">
      <div className="flex items-center gap-3">
        <Link href={back} aria-label="Leave and go back to levels" className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground">
          <Cross className="size-6" aria-hidden />
        </Link>
        <div role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={marks.length} className="flex flex-1 gap-1">
          {items.map((_, i) => (
            <span
              key={i}
              className={cn("h-2.5 flex-1 rounded-full transition-colors", i < marks.length ? (marks[i] ? "bg-success" : "bg-destructive") : i === index ? "bg-primary/40" : "bg-muted")}
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

      {special ? (
        outcome ? (
          <Review item={item} gap={gap} />
        ) : (
          <SpecialSlot key={`${index}-${gapAt}`} item={item} gap={gap} onAnswer={answer} />
        )
      ) : (
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
                {finished && result && !result.right && result.said.length ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    You chose: <span className="text-foreground"><Lines lines={result.said} inline /></span>
                  </p>
                ) : null}
              </li>
            );
          })}
          {!outcome ? (
            <li className="animate-rise">
              <GapSlot key={`${index}-${gapAt}`} gap={gap} title={title} showHeading={item.showHeading} onAnswer={answer} />
            </li>
          ) : null}
        </ol>
      )}

      {outcome ? (
        <div className={cn("animate-rise rounded-2xl border-2 border-b-[6px] p-4", outcome.right ? "border-success bg-success-soft" : "border-destructive bg-danger-soft")}>
          <p role="status" className={cn("font-display text-xl font-semibold leading-tight", outcome.right ? "text-primary-edge" : "text-destructive-edge")}>
            {outcome.right ? "Correct!" : "Not quite."}
          </p>
          <p className="mt-1.5 leading-snug">{feedbackText(item, gap, outcome, title)}</p>
          {moreToShow ? <p className="mt-1.5 text-sm text-muted-foreground">Now see how the working carries on, one step at a time.</p> : null}
          <button
            type="button"
            autoFocus
            onClick={() => (moreToShow ? setExtra(extra + 1) : next())}
            className={buttonVariants({ variant: outcome.right ? "default" : "coral", size: "lg", className: "mt-3 w-full" })}
          >
            {moreToShow ? "Show the next step" : !lastGap ? "Continue the working" : index + 1 >= items.length ? "See my stars" : "Next question"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** What to tell the student after an answer: what the step was, and what went wrong if it did. */
function feedbackText(item: Item, gap: Gap, outcome: Outcome, title: string) {
  const p = item.puzzle;
  if (gap.mode === "answer") {
    return outcome.right ? "That is the answer. The working below shows how it comes out." : "Read the working below to see how the answer comes out, step by step.";
  }
  if (gap.mode === "order") {
    return outcome.right ? "That is the order the working goes in." : `${outcome.note ?? ""} The correct order is below. Each line leads to the next.`.trim();
  }
  if (gap.mode === "why") {
    return outcome.right ? `Yes. The move was: ${title}.` : `${outcome.note ?? ""} The move was: ${title}.`.trim();
  }
  if (gap.mode === "spot") {
    const mistake = gap.spot?.mistake ?? null;
    if (outcome.right) return mistake === null ? "Every line was right. Checking each one against its heading is how you know." : `Yes. Line ${mistake + 1} was wrong. ${p.design.explanation}`;
    return mistake === null ? "Every line was right this time. Check each line against its heading before you call it wrong." : `${outcome.note ?? ""} The mistake was in line ${mistake + 1}. ${p.design.explanation}`.trim();
  }
  if (outcome.right) return `The step was: ${title}.`;
  const why = matchesSlip(p, outcome.said) ? p.design.explanation : null;
  const base = `The step was: “${title}”. The correct line is shown in green above.`;
  return why ? `${base} ${why}` : base;
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

/** The one thing the student is asked to do, in a plain sentence. */
function Task({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-base font-semibold leading-snug text-primary">
      <span className="mr-1.5 rounded-md bg-primary px-1.5 py-0.5 text-xs uppercase tracking-wide text-primary-foreground">Your turn</span>
      {children}
    </p>
  );
}

const slot = "rounded-2xl border-2 border-dashed border-primary bg-secondary/50 px-4 py-3.5";

/** The open gap: pick a line, build it from pieces, or type the answer. Answering is final, so there is no retry. */
function GapSlot({ gap, title, showHeading, onAnswer }: { gap: Gap; title: string; showHeading: boolean; onAnswer: (o: Outcome) => void }) {
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
        className={slot}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Task>
          <label htmlFor="final-answer">Work out the answer and type it in.</label>
        </Task>
        <input
          id="final-answer"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Your answer"
          className="mt-2.5 h-14 w-full rounded-xl border-2 border-border bg-card px-3 font-display text-2xl focus-visible:border-primary focus-visible:outline-none"
        />
        <button type="submit" disabled={!typed.trim()} className={buttonVariants({ size: "lg", className: "mt-3 w-full" })}>
          Check
        </button>
      </form>
    );
  }

  const verb = gap.mode === "pick" ? "Pick" : "Build";
  return (
    <div className={slot}>
      <Task>
        {showHeading ? (
          <>
            The next step is “{title}”. {verb} the line that shows it done.
          </>
        ) : (
          <>Work out the next line yourself and {verb.toLowerCase()} it.</>
        )}
      </Task>
      {gap.mode === "pick" ? (
        <ul className="mt-2.5 grid gap-2.5">
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
          <p className="mt-2.5 text-sm text-muted-foreground">Tap the pieces in order. Tap a piece in your line to take it out.</p>
          <div className="mt-1.5 flex min-h-14 flex-wrap items-center gap-1.5 rounded-xl border-2 border-border bg-card px-2.5 py-2" aria-label="Your line">
            {built.length === 0 ? <span className="text-muted-foreground">Your line goes here</span> : null}
            {built.map((p, i) => (
              <button
                key={i}
                type="button"
                aria-label="Remove this piece"
                onClick={() => setBuilt(built.filter((_, k) => k !== i))}
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

/** Put in order, Name the step, Spot the mistake. */
function SpecialSlot({ item, gap, onAnswer }: { item: Item; gap: Gap; onAnswer: (o: Outcome) => void }) {
  const steps = item.puzzle.steps;
  const [picked, setPicked] = useState<number[]>([]);

  if (gap.mode === "order" && gap.shuffled) {
    const order = gap.shuffled;
    return (
      <div className={slot}>
        <Task>Tap the steps in the order you would do them. First step first.</Task>
        <ul className="mt-2.5 grid gap-2.5">
          {order.map((stepIndex) => {
            const place = picked.indexOf(stepIndex);
            return (
              <li key={stepIndex}>
                <button
                  type="button"
                  onClick={() => setPicked(place >= 0 ? picked.filter((v) => v !== stepIndex) : [...picked, stepIndex])}
                  className={cn(
                    "game-card game-tap flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    place >= 0 && "border-primary bg-card",
                  )}
                >
                  <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-full font-display text-base font-semibold", place >= 0 ? "bg-primary text-primary-foreground" : "bg-muted text-transparent")}>
                    {place >= 0 ? place + 1 : "·"}
                  </span>
                  <Lines lines={steps[stepIndex].lines} />
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          disabled={picked.length !== order.length}
          onClick={() => {
            const right = picked.every((v, i) => v === i);
            onAnswer({ right, said: [], note: right ? undefined : `You put them in the order ${picked.map((v) => order.indexOf(v) + 1).join(", ")} (counting from the top).` });
          }}
          className={buttonVariants({ size: "lg", className: "mt-3 w-full" })}
        >
          {picked.length === order.length ? "Check the order" : `Tap ${order.length - picked.length} more`}
        </button>
      </div>
    );
  }

  if (gap.mode === "why" && gap.whyOptions) {
    return (
      <div className={slot}>
        <Task>What was done to get from the first line to the second?</Task>
        <div className="mt-2.5 grid gap-2">
          <div className="rounded-xl border-2 border-border bg-card px-4 py-2">
            <Lines lines={steps[gap.step - 1].lines} />
          </div>
          <p aria-hidden className="text-center text-muted-foreground">↓</p>
          <div className="rounded-xl border-2 border-border bg-card px-4 py-2">
            <Lines lines={steps[gap.step].lines} />
          </div>
        </div>
        <ul className="mt-3 grid gap-2.5">
          {gap.whyOptions.map((o) => (
            <li key={o}>
              <button
                type="button"
                onClick={() => onAnswer({ right: o === steps[gap.step].title, said: [], note: o === steps[gap.step].title ? undefined : `You chose “${o}”.` })}
                className="game-card game-tap w-full px-4 py-3 text-left text-base font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (gap.mode === "spot" && gap.spot) {
    const { shown, mistake } = gap.spot;
    return (
      <div className={slot}>
        <Task>Check each line against its heading. Tap the line that is wrong, or say they are all right.</Task>
        <ul className="mt-2.5 grid gap-2.5">
          {shown.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => onAnswer({ right: mistake === i, said: [], note: mistake === i ? undefined : `You picked line ${i + 1}.` })}
                className="game-card game-tap w-full px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="block text-sm font-semibold text-muted-foreground">
                  {i + 1}. {s.title}
                </span>
                <Lines lines={s.lines} />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => onAnswer({ right: mistake === null, said: [], note: mistake === null ? undefined : "You said every line was right." })}
          className={buttonVariants({ variant: "outline", size: "lg", className: "mt-3 w-full" })}
        >
          Every line is right
        </button>
      </div>
    );
  }
  return null;
}

/** After one of those games is answered, the whole working with each line's heading. */
function Review({ item, gap }: { item: Item; gap: Gap }) {
  const steps = gap.mode === "spot" && gap.spot ? gap.spot.shown : item.puzzle.steps;
  const mistake = gap.mode === "spot" ? (gap.spot?.mistake ?? null) : null;
  return (
    <ol className="flex flex-col gap-2.5" aria-label="The working">
      {steps.map((s, i) => {
        const wrong = mistake === i;
        const marked = gap.mode === "why" && (i === gap.step || i === gap.step - 1);
        return (
          <li key={i} className={cn("animate-rise rounded-2xl border-2 px-4 py-3", wrong ? "border-destructive bg-danger-soft" : marked ? "border-success bg-success-soft" : "border-border bg-card")}>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              {wrong ? <Cross aria-hidden className="size-4 text-destructive" strokeWidth={3.5} /> : null}
              {i + 1}. {s.title}
            </p>
            <Lines lines={s.lines} />
            {wrong ? (
              <p className="mt-1 text-sm text-muted-foreground">
                It should be: <span className="text-foreground"><Lines lines={item.puzzle.steps[i].lines} inline /></span>
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

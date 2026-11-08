"use client";

import { ArrowRight, Check, RotateCcw, X as Cross } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Confetti, Stars } from "@/components/game/game-ui";
import { buttonVariants } from "@/components/ui/button";
import {
  CONCORD_LEVELS,
  MIXED_ID,
  ROUNDS_PER_LEVEL,
  SENTENCES_PER_LEVEL,
  SENTENCES_PER_ROUND,
  concordStars,
  drawItems,
  levelById,
} from "@/lib/games/concord/levels";
import { cn } from "@/lib/utils";

type Stage = "intro" | "play" | "roundEnd" | "done";

interface Drag {
  word: string;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  moved: boolean;
  over: boolean;
}

const MOVE_THRESHOLD = 8;

export function ConcordPlayer({
  levelId,
  onFinish,
  onAgain,
}: {
  levelId: string;
  onFinish: (stars: number, correct: number) => void;
  onAgain: () => void;
}) {
  const isMixed = levelId === MIXED_ID;
  const level = levelById(levelId);
  const [items] = useState(() => drawItems(levelId));
  const [stage, setStage] = useState<Stage>(isMixed ? "play" : "intro");
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [marks, setMarks] = useState<boolean[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const zoneRef = useRef<HTMLDivElement>(null);

  const item = items[index];
  const correctCount = marks.filter(Boolean).length;
  const round = Math.floor(index / SENTENCES_PER_ROUND);
  const roundStart = round * SENTENCES_PER_ROUND;
  const roundCorrect = marks.slice(roundStart, roundStart + SENTENCES_PER_ROUND).filter(Boolean).length;
  const answered = picked !== null;
  const wasRight = picked === item?.answer;

  function choose(word: string) {
    if (picked !== null || !item) return;
    setPicked(word);
    setMarks((m) => [...m, word === item.answer]);
  }

  function next() {
    const last = index + 1 >= items.length;
    if (last) {
      const total = items.length || SENTENCES_PER_LEVEL;
      onFinish(concordStars(correctCount, total), correctCount);
      setStage("done");
    } else if ((index + 1) % SENTENCES_PER_ROUND === 0) {
      setStage("roundEnd");
    } else {
      setIndex(index + 1);
      setPicked(null);
    }
  }

  function nextRound() {
    setIndex(index + 1);
    setPicked(null);
    setStage("play");
  }

  function inZone(x: number, y: number) {
    const rect = zoneRef.current?.getBoundingClientRect();
    if (!rect) return false;
    const pad = 24;
    return x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad;
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>, word: string) {
    if (answered) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ word, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, moved: false, over: false });
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    setDrag((d) => {
      if (!d) return d;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      const moved = d.moved || Math.hypot(dx, dy) > MOVE_THRESHOLD;
      return { ...d, dx, dy, moved, over: moved && inZone(e.clientX, e.clientY) };
    });
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag;
    setDrag(null);
    if (!d) return;
    // A tap places the word too, so the game also works for anyone who finds dragging hard.
    if (!d.moved || inZone(e.clientX, e.clientY)) choose(d.word);
  }

  if (!item && stage !== "done") return null;

  if (stage === "intro" && level) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 animate-rise">
        <BackLink />
        <section className="game-card p-5 sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            Level {CONCORD_LEVELS.findIndex((l) => l.id === level.id) + 1}
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
        <button
          type="button"
          autoFocus
          onClick={() => setStage("play")}
          className={buttonVariants({ size: "xl", className: "w-full" })}
        >
          Start
          <ArrowRight aria-hidden />
        </button>
        <p className="text-center text-sm text-muted-foreground">
          {ROUNDS_PER_LEVEL} rounds, {SENTENCES_PER_ROUND} sentences each. Drag the right word into the gap.
        </p>
      </div>
    );
  }

  if (stage === "roundEnd") {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 animate-rise">
        <ProgressTop marks={marks} index={index} total={items.length} />
        <section className="game-card p-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Round {round + 1} done</p>
          <p className="mt-2 font-display text-5xl font-semibold">
            {roundCorrect}
            <span className="text-2xl text-muted-foreground"> / {SENTENCES_PER_ROUND}</span>
          </p>
          <p className="mt-2 text-lg text-muted-foreground">
            {roundCorrect === SENTENCES_PER_ROUND ? "Perfect round!" : roundCorrect >= 3 ? "Good going. Keep it up." : "Keep going. The rule will stick."}
          </p>
        </section>
        <button type="button" autoFocus onClick={nextRound} className={buttonVariants({ size: "xl", className: "w-full" })}>
          Round {round + 2}
          <ArrowRight aria-hidden />
        </button>
      </div>
    );
  }

  if (stage === "done") {
    const total = items.length || SENTENCES_PER_LEVEL;
    const stars = concordStars(correctCount, total);
    const levelIndex = CONCORD_LEVELS.findIndex((l) => l.id === levelId);
    const nextLevel = !isMixed && stars >= 1 ? CONCORD_LEVELS[levelIndex + 1] : undefined;
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
          <Link href={`/games/concord/${nextLevel.id}`} className={buttonVariants({ size: "xl", className: "w-full" })}>
            Next: {nextLevel.title}
            <ArrowRight aria-hidden />
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onAgain}
          className={buttonVariants({ variant: nextLevel ? "outline" : "default", size: "xl", className: "w-full" })}
        >
          <RotateCcw aria-hidden />
          Play again
        </button>
        <Link href="/games/concord" className={buttonVariants({ variant: "ghost", size: "lg", className: "w-full" })}>
          Back to levels
        </Link>
      </div>
    );
  }

  const [before, after] = item.text.split("___");
  const choices = item.options;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <ProgressTop marks={marks} index={index} total={items.length} />

      <div ref={zoneRef} className="game-card px-4 py-8 text-center sm:px-6">
        <p className="font-display text-2xl font-semibold leading-[2.6] sm:text-3xl sm:leading-[2.6]">
          <span className="sr-only">Fill in the gap. </span>
          {before}
          <Gap word={picked} right={wasRight} active={drag?.over ?? false} />
          {after}
        </p>
      </div>

      {answered ? (
        <Feedback right={wasRight} item={item} picked={picked} onContinue={next} last={index + 1 >= items.length} endsRound={(index + 1) % SENTENCES_PER_ROUND === 0} />
      ) : (
        <>
          <p className="text-center text-sm font-medium text-muted-foreground">Drag a word into the gap</p>
          <div className="grid grid-cols-2 gap-3">
            {choices.map((word) => {
              const dragging = drag?.word === word;
              return (
                <button
                  key={word}
                  type="button"
                  onPointerDown={(e) => onPointerDown(e, word)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={() => setDrag(null)}
                  onClick={(e) => {
                    // Keyboard activation only. Pointer taps are handled on pointer up.
                    if (e.detail === 0) choose(word);
                  }}
                  style={dragging && drag.moved ? { transform: `translate(${drag.dx}px, ${drag.dy}px) scale(1.06)` } : undefined}
                  className={cn(
                    "game-card relative h-18 touch-none select-none font-display text-2xl font-semibold",
                    "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    dragging && drag.moved ? "z-20 cursor-grabbing border-primary shadow-xl" : "cursor-grab transition-transform active:translate-y-0.5",
                  )}
                >
                  {word}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Gap({ word, right, active }: { word: string | null; right: boolean; active: boolean }) {
  return (
    <span
      className={cn(
        "mx-1 inline-flex h-12 min-w-28 items-center justify-center rounded-xl border-2 px-3 align-middle transition-colors",
        word === null
          ? active
            ? "border-primary bg-secondary"
            : "border-dashed border-primary/50 bg-muted/60"
          : right
            ? "animate-pop border-success bg-success-soft text-success"
            : "animate-shake border-destructive bg-danger-soft text-destructive",
      )}
    >
      {word}
    </span>
  );
}

function Feedback({
  right,
  item,
  picked,
  onContinue,
  last,
  endsRound,
}: {
  right: boolean;
  item: { text: string; answer: string; why: string };
  picked: string | null;
  onContinue: () => void;
  last: boolean;
  endsRound: boolean;
}) {
  const [before, after] = item.text.split("___");
  return (
    <div
      className={cn(
        "animate-rise rounded-2xl border-2 border-b-[6px] p-4",
        right ? "border-success bg-success-soft" : "border-destructive bg-danger-soft",
      )}
    >
      <div role="status" className="flex items-center gap-3">
        <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-full text-white", right ? "bg-success" : "bg-destructive")}>
          {right ? <Check className="size-6" strokeWidth={3.5} /> : <Cross className="size-6" strokeWidth={3.5} />}
        </span>
        <p className={cn("font-display text-xl font-semibold leading-tight", right ? "text-primary-edge" : "text-destructive-edge")}>
          {right ? "Correct!" : `Not quite. You chose "${picked}".`}
        </p>
      </div>
      <p className="mt-2.5 text-lg leading-snug">
        {before}
        <strong className={cn("rounded px-1", right ? "bg-success/15" : "bg-success/20")}>{item.answer}</strong>
        {after}
      </p>
      <p className="mt-1 leading-snug text-muted-foreground">{item.why}</p>
      <button
        type="button"
        autoFocus
        onClick={onContinue}
        className={buttonVariants({ variant: right ? "default" : "coral", size: "lg", className: "mt-3 w-full" })}
      >
        {last ? "See my stars" : endsRound ? "Finish round" : "Continue"}
      </button>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/games/concord" className="inline-flex h-11 w-fit items-center gap-1.5 rounded-xl px-2 font-semibold text-muted-foreground hover:text-foreground">
      <Cross className="size-5" aria-hidden />
      Levels
    </Link>
  );
}

function ProgressTop({ marks, index, total }: { marks: boolean[]; index: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      <Link href="/games/concord" aria-label="Leave and go back to levels" className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground">
        <Cross className="size-6" aria-hidden />
      </Link>
      <div
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={marks.length}
        className="flex flex-1 items-center gap-2"
      >
        {Array.from({ length: Math.ceil(total / SENTENCES_PER_ROUND) }, (_, r) => (
          <div key={r} className="flex flex-1 gap-1">
            {Array.from({ length: SENTENCES_PER_ROUND }, (_, i) => {
              const n = r * SENTENCES_PER_ROUND + i;
              const done = n < marks.length;
              return (
                <span
                  key={i}
                  className={cn(
                    "h-2.5 flex-1 rounded-full transition-colors",
                    done ? (marks[n] ? "bg-success" : "bg-destructive") : n === index ? "bg-primary/40" : "bg-muted",
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

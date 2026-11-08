"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Flag, Grid3x3, Loader2, Timer, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Meter, XpPill } from "@/components/game/game-ui";
import { AnswerFeedback } from "@/components/session/answer-feedback";
import { QuestionNavigator } from "@/components/session/question-navigator";
import { QuestionView } from "@/components/session/question-view";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatClock, useCountdown } from "@/hooks/use-countdown";
import { data, SessionClosedError } from "@/lib/data";
import { MODE_LABEL } from "@/lib/engine/presets";
import { XP } from "@/lib/game/rules";
import { SUBJECTS } from "@/lib/catalog";
import { warmConnection } from "@/lib/supabase/client";
import type { OptionKey, PracticeSession, QuestionReveal } from "@/lib/types";
import { cn } from "@/lib/utils";

const KEY_MAP: Record<string, OptionKey> = { a: "A", b: "B", c: "C", d: "D", "1": "A", "2": "B", "3": "C", "4": "D" };

export function SessionRunner({ initial }: { initial: PracticeSession }) {
  const router = useRouter();
  const [session, setSession] = useState(initial);
  const [index, setIndex] = useState(() => firstUnansweredIndex(initial));
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** Instant mode: the option picked but not yet submitted, so it can still be changed. */
  const [drafts, setDrafts] = useState<Record<string, OptionKey>>({});
  const [checking, setChecking] = useState(false);
  /** Answers not yet confirmed by the server, retried when the connection returns. */
  const unsynced = useRef(new Map<string, OptionKey>());

  const { config, questions } = session;
  const instant = config.feedback === "instant";
  const isMock = config.mode === "mock";
  const freeNav = !instant;
  const current = questions[index];
  const total = questions.length;
  const answeredIds = useMemo(() => new Set(Object.keys(session.answers)), [session.answers]);
  const unansweredCount = total - answeredIds.size;
  const isLast = index === total - 1;

  /** Correct answers in a row to the most recent revealed question, and XP earned this round so far. */
  const { combo, roundXp } = useMemo(() => {
    let run = 0;
    let correct = 0;
    for (const { question } of questions) {
      const reveal = session.reveals[question.id];
      if (!reveal) continue;
      const right = session.answers[question.id] === reveal.correctOption;
      run = right ? run + 1 : 0;
      if (right) correct++;
    }
    return { combo: run, roundXp: correct * XP.correct };
  }, [questions, session.answers, session.reveals]);

  const submit = useCallback(
    async (reason: "user" | "timeout" | "closed" = "user") => {
      if (submitting) return;
      setSubmitting(true);
      try {
        await data.submitSession(session.id);
        if (reason === "timeout") toast.info("Time's up! Your answers have been submitted.");
        router.replace(`/session/${session.id}/results`);
      } catch {
        toast.error("Couldn't submit. Check your connection and try again.");
        setSubmitting(false);
      }
    },
    [router, session.id, submitting],
  );

  const remainingMs = useCountdown(session.deadlineAt, () => submit("timeout"));

  const persist = useCallback(
    async (questionId: string, option: OptionKey) => {
      try {
        const { reveal } = await data.saveAnswer(session.id, questionId, option);
        unsynced.current.delete(questionId);
        if (reveal) setSession((s) => ({ ...s, reveals: { ...s.reveals, [questionId]: reveal } }));
      } catch (err) {
        if (err instanceof SessionClosedError) return submit("closed");
        unsynced.current.set(questionId, option);
        toast.warning("You're offline. Your answer will be saved when you reconnect.", { id: "offline" });
      }
    },
    [session.id, submit],
  );

  // Instant feedback: keep the connection to the server warm while the student reads the question,
  // and again when they pick an option, so Check does not wait on a cold connection.
  const currentId = questions[index]?.question.id;
  useEffect(() => {
    if (instant) warmConnection();
  }, [instant, currentId, drafts]);

  // Retry unsynced answers when the connection comes back.
  useEffect(() => {
    const flush = () => unsynced.current.forEach((opt, qid) => persist(qid, opt));
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [persist]);

  const select = useCallback(
    (option: OptionKey) => {
      if (!current || submitting) return;
      const qid = current.question.id;
      if (instant) {
        if (session.reveals[qid]) return; // locked after reveal
        setDrafts((d) => ({ ...d, [qid]: option }));
        return;
      }
      setSession((s) => ({ ...s, answers: { ...s.answers, [qid]: option } }));
      persist(qid, option);
    },
    [current, instant, persist, session.reveals, submitting],
  );

  /** Instant mode: locks the chosen option and reveals the answer. */
  const submitAnswer = useCallback(async () => {
    if (!current || checking) return;
    const qid = current.question.id;
    const option = drafts[qid];
    if (!option) return;
    setChecking(true);
    setSession((s) => ({ ...s, answers: { ...s.answers, [qid]: option } }));
    await persist(qid, option);
    setChecking(false);
  }, [checking, current, drafts, persist]);

  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(total - 1, i))), [total]);

  const finish = useCallback(() => {
    if (unansweredCount > 0 || !instant) setConfirmSubmit(true);
    else submit();
  }, [instant, submit, unansweredCount]);

  // Keyboard: A-D / 1-4 select, left and right arrows navigate.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || confirmSubmit || confirmLeave || navOpen) return;
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      const opt = KEY_MAP[e.key.toLowerCase()];
      if (opt) {
        e.preventDefault();
        select(opt);
      } else if (e.key === "Enter" && instant && current && !session.reveals[current.question.id] && drafts[current.question.id]) {
        e.preventDefault();
        submitAnswer();
      } else if (e.key === "ArrowRight" && !isLast) go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmLeave, confirmSubmit, current, drafts, go, index, instant, isLast, navOpen, select, session.reveals, submitAnswer]);

  // Mock: subject tabs jump to the first question of each subject.
  const subjectStarts = useMemo(() => {
    const starts: { subjectId: string; start: number; count: number; answered: number }[] = [];
    questions.forEach((q, i) => {
      const last = starts[starts.length - 1];
      if (!last || last.subjectId !== q.question.subjectId) {
        starts.push({ subjectId: q.question.subjectId, start: i, count: 0, answered: 0 });
      }
      const s = starts[starts.length - 1];
      s.count++;
      if (answeredIds.has(q.question.id)) s.answered++;
    });
    return starts;
  }, [answeredIds, questions]);

  if (!current) return null;

  const qid = current.question.id;
  const reveal = session.reveals[qid] ?? null;
  const choice = drafts[qid] ?? session.answers[qid] ?? null;
  const lowTime = remainingMs !== null && remainingMs <= (isMock ? 5 * 60_000 : 60_000);
  const subjectLabel = SUBJECTS.find((s) => s.id === config.subjectIds[0])?.name;
  const answeredPercent = Math.round((answeredIds.size / total) * 100);

  const navigator = (
    <QuestionNavigator
      items={questions}
      current={index}
      answered={answeredIds}
      flagged={flagged}
      onJump={(i) => {
        go(i);
        setNavOpen(false);
      }}
    />
  );

  const timer =
    remainingMs !== null ? (
      <div
        role="timer"
        aria-live={lowTime ? "assertive" : "off"}
        aria-label={`Time remaining ${formatClock(remainingMs)}`}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 font-mono text-sm font-bold tabular-nums",
          lowTime ? "bg-danger-soft text-destructive" : isMock ? "bg-white/15 text-white" : "bg-muted",
        )}
      >
        <Timer className="size-4" aria-hidden />
        {formatClock(remainingMs)}
      </div>
    ) : null;

  return (
    <div className="flex min-h-dvh flex-col">
      {instant ? (
        <header className="sticky top-0 z-30 bg-background">
          <div className="mx-auto flex h-15 max-w-2xl items-center gap-2 px-2 sm:px-4">
            <Button variant="ghost" size="icon-lg" aria-label="Leave practice" onClick={() => setConfirmLeave(true)}>
              <X aria-hidden className="size-5!" />
            </Button>
            <Meter percent={answeredPercent} label="Round progress" className="h-4 flex-1" barClassName="bg-brand-bright" />
            <RoundXp xp={roundXp} />
          </div>
        </header>
      ) : (
        <header className={cn("sticky top-0 z-30 border-b-2", isMock ? "border-transparent bg-brand-deep text-white" : "bg-background")}>
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-1 px-1 sm:gap-2 sm:px-4">
            <Button
              variant="ghost"
              size="icon-lg"
              className={isMock ? "text-white hover:bg-white/15 hover:text-white" : undefined}
              aria-label="Leave session"
              onClick={() => setConfirmLeave(true)}
            >
              <X aria-hidden />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-semibold leading-tight sm:text-base">{MODE_LABEL[config.mode]}</p>
              <p className={cn("truncate text-xs", isMock ? "text-white/75" : "text-muted-foreground")}>
                {isMock ? "UTME simulation" : subjectLabel}
              </p>
            </div>
            {timer}
            <Button
              variant="outline"
              size="icon-lg"
              className={cn("lg:hidden", isMock && "border-white/30 bg-transparent text-white shadow-none hover:bg-white/15")}
              aria-label="Open question navigator"
              onClick={() => setNavOpen(true)}
            >
              <Grid3x3 aria-hidden />
            </Button>
            <Button
              size="lg"
              variant={isMock ? "gold" : "default"}
              className="hidden sm:inline-flex"
              onClick={finish}
              disabled={submitting}
            >
              Submit
            </Button>
          </div>
          {isMock ? (
            <div className="bg-background text-foreground">
              <div className="mx-auto grid max-w-5xl grid-cols-4 gap-1.5 px-2 py-2 sm:px-4" role="tablist" aria-label="Subjects">
                {subjectStarts.map((s) => {
                  const active = index >= s.start && index < s.start + s.count;
                  return (
                    <button
                      key={s.subjectId}
                      role="tab"
                      aria-selected={active}
                      onClick={() => go(s.start)}
                      className={cn(
                        "min-w-0 rounded-lg border-2 px-1 py-1 text-xs font-semibold leading-tight transition",
                        active ? "border-brand-deep bg-brand-deep text-white" : "bg-card text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span className="block truncate">{SUBJECTS.find((x) => x.id === s.subjectId)?.shortName}</span>
                      <span className="block font-normal tabular-nums">
                        {s.answered}/{s.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <Meter percent={answeredPercent} label="Questions answered" className="h-1.5 rounded-none" barClassName="bg-brand-bright" />
          )}
        </header>
      )}

      <div
        className={cn(
          "mx-auto grid w-full flex-1 gap-8 px-4 pt-4 lg:pt-6",
          "grid-cols-[minmax(0,1fr)]",
          freeNav ? "max-w-5xl lg:grid-cols-[minmax(0,1fr)_17rem]" : "max-w-2xl",
          reveal ? "pb-5" : "pb-28",
        )}
      >
        <div className="mx-auto w-full min-w-0 max-w-2xl">
          <QuestionView
            question={current.question}
            number={index + 1}
            total={total}
            selected={choice}
            reveal={reveal}
            disabled={submitting || checking}
            onSelect={select}
            onReport={() =>
              data.reportQuestion(current.question.id).then(
                () => toast.success("Thanks! We'll review this question."),
                (err: Error) => toast.error(err.message),
              )
            }
          />
          {freeNav ? (
            <button
              type="button"
              onClick={() =>
                setFlagged((f) => {
                  const n = new Set(f);
                  if (n.has(qid)) n.delete(qid);
                  else n.add(qid);
                  return n;
                })
              }
              aria-pressed={flagged.has(qid)}
              className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:bg-muted aria-pressed:text-warning"
            >
              <Flag className="size-4" aria-hidden />
              {flagged.has(qid) ? "Flagged for review" : "Flag for review"}
            </button>
          ) : null}
        </div>

        {freeNav ? (
          <aside className="hidden lg:block">
            <div className="game-card sticky top-36 p-4">
              <p className="mb-3 text-sm font-semibold">
                Questions <span className="font-normal text-muted-foreground">· {answeredIds.size}/{total} answered</span>
              </p>
              <div className="max-h-[55vh] overflow-y-auto pr-1">{navigator}</div>
            </div>
          </aside>
        ) : null}
      </div>

      {reveal ? (
        <FeedbackCard
          key={qid}
          reveal={reveal}
          selected={session.answers[qid] ?? null}
          combo={combo}
          isLast={isLast}
          canGoBack={index > 0}
          submitting={submitting}
          onBack={() => go(index - 1)}
          onContinue={isLast ? finish : () => go(index + 1)}
        />
      ) : (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 bg-background">
          <div className={cn("mx-auto flex gap-3 px-4 py-3", freeNav ? "max-w-2xl lg:max-w-5xl lg:pr-[calc(17rem+3rem)]" : "max-w-2xl")}>
            <Button variant="outline" size="xl" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous question">
              <ArrowLeft aria-hidden />
              <span className="hidden sm:inline">Previous</span>
            </Button>
            {instant && drafts[qid] ? (
              <Button size="xl" className="flex-1" onClick={submitAnswer} disabled={checking}>
                {checking ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Check
              </Button>
            ) : isLast ? (
              <Button size="xl" className="flex-1" onClick={finish} disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {instant ? "See results" : "Submit"}
              </Button>
            ) : (
              <Button size="xl" className="flex-1" onClick={() => go(index + 1)} variant={instant ? "outline" : "default"}>
                {instant ? "Skip" : "Next"}
                <ArrowRight aria-hidden />
              </Button>
            )}
          </div>
        </div>
      )}

      <Dialog open={navOpen} onOpenChange={setNavOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Questions · {answeredIds.size}/{total} answered
            </DialogTitle>
          </DialogHeader>
          {navigator}
          <Button
            size="lg"
            className="mt-2 w-full"
            onClick={() => {
              setNavOpen(false);
              finish();
            }}
          >
            Submit
          </Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{unansweredCount > 0 ? "Submit with unanswered questions?" : "Submit your answers?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {unansweredCount > 0
                ? `You have ${unansweredCount} unanswered question${unansweredCount === 1 ? "" : "s"}. Unanswered questions score zero.`
                : "You won't be able to change your answers after submitting."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {unansweredCount > 0 ? (
              <AlertDialogCancel
                size="lg"
                onClick={() => {
                  const i = questions.findIndex((q) => !answeredIds.has(q.question.id));
                  if (i >= 0) go(i);
                }}
              >
                Review unanswered
              </AlertDialogCancel>
            ) : (
              <AlertDialogCancel size="lg">Keep working</AlertDialogCancel>
            )}
            <Button size="lg" onClick={() => submit()} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Submit
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this session?</AlertDialogTitle>
            <AlertDialogDescription>
              {session.deadlineAt
                ? "Your answers are saved, but the timer keeps running while you're away."
                : "Your answers are saved. You can come back to this session."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="lg">Stay</AlertDialogCancel>
            <Button size="lg" variant="destructive" onClick={() => router.push("/practice")}>
              Leave
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** XP earned this round. Restarting at each value replays the pop, so every gain is felt at the top. */
function RoundXp({ xp }: { xp: number }) {
  // Coming back to a round already holds XP, which should not replay as a new gain.
  const [startXp] = useState(xp);
  const gained = xp > startXp;

  return (
    <span className="relative shrink-0">
      <XpPill key={xp} xp={xp} className={gained ? "animate-pop" : undefined} />
      {gained ? (
        <span
          key={`gain-${xp}`}
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 animate-xp-gain font-display text-sm font-bold text-gold-edge"
        >
          +{XP.correct}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Floats above the bottom of the page after Check. It never scrolls the page: the question and
 * the options stay exactly where the student left them, and they can scroll if they want more.
 */
function FeedbackCard({
  reveal,
  selected,
  combo,
  isLast,
  canGoBack,
  submitting,
  onBack,
  onContinue,
}: {
  reveal: QuestionReveal;
  selected: OptionKey | null;
  combo: number;
  isLast: boolean;
  canGoBack: boolean;
  submitting: boolean;
  onBack: () => void;
  onContinue: () => void;
}) {
  const correct = selected === reveal.correctOption;

  return (
    <div className="sticky bottom-3 z-20 mx-auto w-full max-w-2xl animate-sheet px-3 pb-3 [@media(max-height:500px)]:z-40">
      <AnswerFeedback reveal={reveal} selected={selected} combo={combo} collapsible className="max-h-[78dvh] [@media(max-height:500px)]:max-h-[90dvh]">
        <div className="mt-3.5 flex gap-3">
          {canGoBack ? (
            <Button variant="outline" size="xl" aria-label="Previous question" onClick={onBack}>
              <ArrowLeft aria-hidden />
            </Button>
          ) : null}
          <Button autoFocus size="xl" variant={correct ? "default" : "coral"} className="flex-1" onClick={onContinue} disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {isLast ? "See results" : "Continue"}
          </Button>
        </div>
      </AnswerFeedback>
    </div>
  );
}

function firstUnansweredIndex(s: PracticeSession) {
  const i = s.questions.findIndex((q) => !s.answers[q.question.id]);
  return i === -1 ? 0 : i;
}

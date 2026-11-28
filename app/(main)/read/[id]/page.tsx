"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, X, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LessonBlocks } from "@/components/read/lesson-blocks";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStartSession } from "@/hooks/use-start-session";
import { data } from "@/lib/data";
import { subjectPractice } from "@/lib/engine/presets";
import { useAppState } from "@/lib/app-state";
import { awardRead, getReadLesson } from "@/lib/read/client";
import { READ_XP } from "@/lib/read/xp";
import { cn } from "@/lib/utils";
import { matchTopic } from "@/lib/read/match";
import type { ReadLesson } from "@/lib/read/types";

export default function ReaderPage() {
  const { id } = useParams<{ id: string }>();
  const { start, starting } = useStartSession();
  const [lesson, setLesson] = useState<ReadLesson | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [topic, setTopic] = useState<{ id: string; name: string } | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let live = true;
    getReadLesson(id)
      .then(async (l) => {
        if (!live) return;
        setLesson(l);
        if (l?.subjectId) {
          const topics = await data.listTopics(l.subjectId).catch(() => []);
          if (live) setTopic(matchTopic(topics, [l.topicTitle, l.groupTitle, l.title]));
        }
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [id]);

  if (failed) return <Notice>Couldn&apos;t load this lesson. Check your connection and try again.</Notice>;
  if (lesson === null) return <Notice>This lesson isn&apos;t available any more.</Notice>;
  if (lesson === undefined) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (lesson.format === "embed") {
    return <EmbedReader lesson={lesson} topicId={topic?.id ?? null} />;
  }

  const sections = lesson.sections;
  const last = step === sections.length - 1;
  const current = sections[step];
  const practise = () => lesson.subjectId && start(subjectPractice(lesson.subjectId, topic?.id ?? null, 10));

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/read" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All notes
      </Link>
      <p className="mt-1 font-display text-xs font-semibold tracking-wide text-sky">{lesson.topicTitle.toUpperCase()}</p>
      <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{lesson.title}</h1>

      {current ? (
        <>
          <div
            role="progressbar"
            aria-label="Progress through the lesson"
            aria-valuemin={1}
            aria-valuemax={sections.length}
            aria-valuenow={step + 1}
            className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${((step + 1) / sections.length) * 100}%` }} />
          </div>
          <p className="mt-1.5 text-xs font-medium text-muted-foreground">
            Part {step + 1} of {sections.length}
          </p>

          <h2 className="mt-4 text-2xl font-semibold leading-tight">{current.title}</h2>
          <div className="mt-3">
            <LessonBlocks blocks={current.blocks} />
          </div>
        </>
      ) : (
        <p className="mt-4 text-muted-foreground">This lesson has no notes yet.</p>
      )}

      <div className="sticky bottom-20 z-10 mt-6 flex gap-2 rounded-2xl border-2 bg-background/95 p-2 backdrop-blur sm:bottom-4">
        <Button variant="outline" size="xl" aria-label="Previous part" disabled={step === 0} onClick={() => setStep(step - 1)} className="w-14 shrink-0 px-0">
          <ChevronLeft aria-hidden />
        </Button>
        {last || !current ? (
          <Button size="xl" variant="gold" className="flex-1" disabled={starting || !lesson.subjectId} onClick={practise}>
            {starting ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {topic ? "Practise this topic" : "Practise this subject"}
          </Button>
        ) : (
          <Button size="xl" className="flex-1" onClick={() => setStep(step + 1)}>
            Next <ChevronRight aria-hidden />
          </Button>
        )}
      </div>
      {!last && current && lesson.subjectId ? (
        <button
          type="button"
          onClick={practise}
          disabled={starting}
          className="mx-auto mt-3 block min-h-11 px-3 text-sm font-semibold text-primary hover:underline"
        >
          {topic ? "Skip to practice on this topic" : "Skip to practice"}
        </button>
      ) : null}
    </div>
  );
}

/**
 * A Read & Learn lesson on its own full screen, like a game round: a close button, a progress bar that fills as the
 * student moves through the lesson, and XP at the end. The lesson itself is EXL's reader, in a frame.
 */
function EmbedReader({ lesson, topicId }: { lesson: ReadLesson; topicId: string | null }) {
  const router = useRouter();
  const { start, starting } = useStartSession();
  const { isGuest, progress, setProgress } = useAppState();
  const [frac, setFrac] = useState(0);
  const [done, setDone] = useState(false);
  const [award, setAward] = useState<{ awarded: number } | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const finished = useRef(false);

  // The lesson reports where the student is and when they reach the end.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== frame.current?.contentWindow) return;
      const m = e.data as { source?: string; type?: string; section?: number; sections?: number };
      if (m?.source !== "exl-lesson") return;
      if (typeof m.section === "number" && typeof m.sections === "number" && m.sections > 0) {
        const next = Math.min(1, Math.max(0, (m.section - 1) / m.sections));
        setFrac((f) => Math.max(f, next));
      }
      if ((m.type === "complete" || m.type === "finish") && !finished.current) {
        finished.current = true;
        setFrac(1);
        setDone(true);
        if (!isGuest) {
          awardRead(lesson.id).then((r) => {
            if (!r) return;
            setAward(r);
            if (r.awarded > 0) setProgress({ ...progress, xp: progress.xp + r.awarded });
          });
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [lesson.id, isGuest, progress, setProgress]);

  const practise = () => lesson.subjectId && start(subjectPractice(lesson.subjectId, topicId, 10));
  const pct = Math.round(frac * 100);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="mx-auto flex w-full max-w-3xl items-center gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <Link
          href="/read"
          aria-label="Close and go back to Read"
          className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-6" aria-hidden />
        </Link>
        <div
          role="progressbar"
          aria-label="Progress through the lesson"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="h-4 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn("h-full rounded-full transition-[width,background-color] duration-500", done ? "bg-gold" : "bg-primary")}
            style={{ width: `${Math.max(pct, 4)}%` }}
          />
        </div>
        <span
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 font-display text-sm font-semibold",
            done ? "bg-gold text-gold-ink" : "bg-gold-soft text-gold-ink",
          )}
        >
          <Zap className="size-4 fill-gold text-gold-edge" aria-hidden />
          {READ_XP} XP
        </span>
      </header>

      <iframe
        ref={frame}
        title={lesson.title}
        src={`/api/read/embed/${lesson.id}`}
        // No sandbox attribute: the page itself arrives with a CSP sandbox header (scripts only, no access to this app).
        className="mx-auto min-h-0 w-full max-w-3xl flex-1 border-0 bg-background"
      />

      {done ? (
        <div className="mx-auto w-full max-w-3xl px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="game-card p-4 text-center">
            <p className="font-display text-xl font-semibold">Lesson complete</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isGuest
                ? "Create an account to earn XP for reading."
                : award === null
                  ? "Adding your XP…"
                  : award.awarded > 0
                    ? `+${award.awarded} XP added to your total.`
                    : "You have already earned XP for this one."}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row-reverse">
              {lesson.subjectId ? (
                <Button size="xl" variant="gold" className="flex-1" disabled={starting} onClick={practise}>
                  {starting ? <Loader2 className="animate-spin" aria-hidden /> : null}
                  {topicId ? "Practise this topic" : "Practise this subject"}
                </Button>
              ) : null}
              <Button size="xl" variant="outline" className="flex-1" onClick={() => router.push("/read")}>
                Back to Read
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md pt-10 text-center">
      <p className="text-muted-foreground">{children}</p>
      <Link href="/read" className="mt-4 inline-flex min-h-11 items-center font-semibold text-primary hover:underline">
        Back to all notes
      </Link>
    </div>
  );
}

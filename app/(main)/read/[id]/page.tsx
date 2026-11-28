"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LessonBlocks } from "@/components/read/lesson-blocks";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStartSession } from "@/hooks/use-start-session";
import { data } from "@/lib/data";
import { subjectPractice } from "@/lib/engine/presets";
import { getReadLesson } from "@/lib/read/client";
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

/** A Read & Learn lesson in EXL's own reader, in a sandboxed frame. Our button sits under it. */
function EmbedReader({ lesson, topicId }: { lesson: ReadLesson; topicId: string | null }) {
  const { start, starting } = useStartSession();
  const [done, setDone] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  // The lesson tells us when the student reaches the end, so the practice button can step forward.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== frame.current?.contentWindow) return;
      const m = e.data as { source?: string; type?: string };
      if (m?.source === "exl-lesson" && (m.type === "complete" || m.type === "finish")) setDone(true);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const practise = () => lesson.subjectId && start(subjectPractice(lesson.subjectId, topicId, 10));
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/read" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All notes
      </Link>
      <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">{lesson.title}</h1>
      <iframe
        ref={frame}
        title={lesson.title}
        src={`/api/read/embed/${lesson.id}`}
        // No sandbox attribute: the page itself arrives with a CSP sandbox header (scripts only, no access to this app).
        className="mt-3 h-[70dvh] min-h-[28rem] w-full rounded-2xl border-2 bg-card"
      />
      {lesson.subjectId ? (
        <Button size="xl" variant={done ? "gold" : "outline"} className="mt-3 w-full" disabled={starting} onClick={practise}>
          {starting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {topicId ? "Practise this topic" : "Practise this subject"}
        </Button>
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

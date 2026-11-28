"use client";

import Link from "next/link";
import { BookOpen, Check, ChevronDown, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SubjectIcon } from "@/components/game/game-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppState } from "@/lib/app-state";
import { SUBJECTS } from "@/lib/catalog";
import { MINUTE, cached } from "@/lib/cache";
import { getReadCatalogue, prefetchLesson } from "@/lib/read/client";
import { getLastRead, type LastRead } from "@/lib/read/last";
import { supabase } from "@/lib/supabase/client";
import type { ReadCatalogue, ReadSubject } from "@/lib/read/types";
import { cn } from "@/lib/utils";

const lessonCount = (s: ReadSubject) => s.topics.reduce((n, t) => n + t.lessons.length, 0);

/**
 * Read. Short notes by subject and topic. A phone gets a row of subjects above the topics; a desktop gets the
 * subjects down the left and the topics beside them. The student's own subjects come first, finished lessons
 * carry a tick, and the lesson they opened last is one tap away.
 */
export default function ReadPage() {
  const { profile, isGuest } = useAppState();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [catalogue, setCatalogue] = useState<ReadCatalogue | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [last, setLast] = useState<LastRead | null>(null);
  const [shut, setShut] = useState<Set<string>>(new Set());
  const [opened, setOpened] = useState<Set<string>>(new Set());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the last lesson is kept in the browser, so it is read after the first render
    setLast(getLastRead());
    let live = true;
    getReadCatalogue()
      .then((c) => live && setCatalogue(c))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  // Lessons the student has finished get a tick.
  useEffect(() => {
    if (isGuest) return;
    let live = true;
    cached("user:read-done", 10 * MINUTE, async () => {
      const { data, error } = await supabase().from("read_completions").select("lesson_id");
      if (error) throw error;
      return (data ?? []).map((r) => r.lesson_id as string);
    })
      .then((ids) => live && setDone(new Set(ids)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [isGuest]);

  // The student's own subjects come first.
  const subjects = useMemo(() => {
    const mine = profile?.subjectIds ?? [];
    return [...(catalogue?.subjects ?? [])].sort((a, b) => Number(mine.includes(b.subjectId ?? "")) - Number(mine.includes(a.subjectId ?? "")));
  }, [catalogue, profile]);

  const comingSoon = (profile?.subjectIds ?? [])
    .filter((id) => !subjects.some((s) => s.subjectId === id))
    .map((id) => SUBJECTS.find((s) => s.id === id)?.shortName)
    .filter(Boolean);

  const q = query.trim().toLowerCase();
  const active = picked && subjects.some((s) => s.slug === picked) ? picked : (subjects[0]?.slug ?? null);
  const shown = subjects
    .filter((s) => q || s.slug === active)
    .map((s) => ({
      ...s,
      topics: s.topics
        .map((t) => ({
          ...t,
          lessons: q ? t.lessons.filter((l) => `${l.title} ${l.description} ${t.title} ${s.name}`.toLowerCase().includes(q)) : t.lessons,
        }))
        .filter((t) => t.lessons.length > 0),
    }))
    .filter((s) => s.topics.length > 0);

  // The first topic with something unread starts open; the rest start shut so a long subject stays easy to scan.
  const defaultOpen = (s: ReadSubject) => s.topics.find((t) => t.lessons.some((l) => !done.has(l.id)))?.id ?? s.topics[0]?.id;
  const isOpen = (s: ReadSubject, topicId: string) => (q ? true : opened.has(topicId) ? true : shut.has(topicId) ? false : defaultOpen(s) === topicId);
  const toggle = (s: ReadSubject, topicId: string) => {
    const open = isOpen(s, topicId);
    setOpened((o) => {
      const n = new Set(o);
      if (open) n.delete(topicId);
      else n.add(topicId);
      return n;
    });
    setShut((o) => {
      const n = new Set(o);
      if (open) n.add(topicId);
      else n.delete(topicId);
      return n;
    });
  };

  const showContinue = last && !q && subjects.some((s) => s.topics.some((t) => t.lessons.some((l) => l.id === last.id)));

  return (
    <div>
      <header>
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Read</h1>
        <p className="mt-0.5 text-muted-foreground">Short notes by topic. Read, then practise.</p>
      </header>

      {catalogue === null && !failed ? (
        <div className="mt-5 space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : null}

      {failed ? (
        <div className="game-card mt-5 p-5 text-center">
          <p className="font-display text-lg font-semibold">Couldn&apos;t load the notes</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Check your connection and try again.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-3 min-h-11 px-3 font-semibold text-primary hover:underline">
            Try again
          </button>
        </div>
      ) : null}

      {catalogue && subjects.length === 0 ? (
        <div className="game-card mt-5 p-5 text-center">
          <BookOpen className="mx-auto size-8 text-sky" aria-hidden />
          <p className="mt-2 font-display text-lg font-semibold">Notes are on their way</p>
          <p className="text-sm text-muted-foreground">New topics are added all the time. Check back soon.</p>
        </div>
      ) : null}

      {subjects.length > 0 ? (
        <div className="mt-4 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-6">
          {/* Subjects: a row on a phone, a list on a desktop. */}
          <div className="lg:sticky lg:top-20">
            <label className="relative block">
              <span className="sr-only">Search the notes</span>
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search topics"
                className="h-12 w-full rounded-2xl border-2 bg-card pr-3 pl-11 text-base focus-visible:border-primary focus-visible:outline-none"
              />
            </label>

            {!q ? (
              <div role="group" aria-label="Subject" className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
                {subjects.map((s) => {
                  const total = lessonCount(s);
                  const finished = s.topics.reduce((n, t) => n + t.lessons.filter((l) => done.has(l.id)).length, 0);
                  const on = s.slug === active;
                  return (
                    <button
                      key={s.slug}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPicked(s.slug)}
                      className={cn(
                        "flex min-h-12 shrink-0 items-center gap-2.5 rounded-xl border-2 px-3 text-left font-display text-sm font-semibold transition-colors lg:w-full",
                        on ? "border-primary bg-secondary text-primary" : "bg-card text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {s.subjectId ? <SubjectIcon id={s.subjectId} className="size-7 rounded-lg" iconClassName="size-4" /> : null}
                      <span className="min-w-0 flex-1">
                        <span className="block leading-tight">{s.name}</span>
                        <span className="block text-[0.7rem] font-medium text-muted-foreground">
                          {finished > 0 ? `${finished} of ${total} read` : `${total} ${total === 1 ? "lesson" : "lessons"}`}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex min-w-0 flex-col gap-4 lg:mt-0">
            {showContinue && last ? (
              <Link href={`/read/${last.id}`} onPointerEnter={() => prefetchLesson(last.id, "embed")} className="game-card game-tap flex items-center gap-3 p-3.5">
                <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sky text-white">
                  <BookOpen className="size-6" strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold tracking-wide text-sky">PICK UP WHERE YOU LEFT OFF</span>
                  <span className="block truncate font-display text-lg leading-tight font-semibold">{last.title}</span>
                  {last.topic ? <span className="block truncate text-xs text-muted-foreground">{last.topic}</span> : null}
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            ) : null}

            {shown.map((s) => (
              <section key={s.slug} aria-label={s.name} className="flex flex-col gap-3">
                {q ? <h2 className="font-display text-lg font-semibold">{s.name}</h2> : null}
                {s.topics.map((t) => {
                  const finished = t.lessons.filter((l) => done.has(l.id)).length;
                  const open = isOpen(s, t.id);
                  const panel = `topic-${t.id}`;
                  return (
                    <div key={t.id} className="game-card overflow-hidden">
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={panel}
                        onClick={() => toggle(s, t.id)}
                        className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-display text-[1.05rem] leading-tight font-semibold">{t.title}</span>
                          <span className="mt-1.5 flex items-center gap-2">
                            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" aria-hidden>
                              <span className="block h-full rounded-full bg-primary" style={{ width: `${(finished / t.lessons.length) * 100}%` }} />
                            </span>
                            <span className="text-xs font-medium text-muted-foreground">
                              {finished === t.lessons.length ? "All read" : `${finished} of ${t.lessons.length} read`}
                            </span>
                          </span>
                        </span>
                        <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
                      </button>

                      {open ? (
                        <ol id={panel} className="border-t-2">
                          {t.lessons.map((l, i) => {
                            const read = done.has(l.id);
                            return (
                              <li key={l.id} className="border-b-2 last:border-b-0">
                                <Link
                                  href={`/read/${l.id}`}
                                  onPointerEnter={() => prefetchLesson(l.id, l.format)}
                                  onFocus={() => prefetchLesson(l.id, l.format)}
                                  className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                                >
                                  <span
                                    aria-hidden
                                    className={cn(
                                      "grid size-8 shrink-0 place-items-center rounded-full font-display text-sm font-semibold",
                                      read ? "bg-primary text-primary-foreground" : "bg-sky-soft text-sky",
                                    )}
                                  >
                                    {read ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block font-display leading-tight font-semibold">{l.title}</span>
                                    <span className="mt-0.5 block text-xs text-muted-foreground">
                                      {read ? "Read" : l.minutes ? `${l.minutes} min read` : "Short read"}
                                      {l.topicTitle && l.topicTitle !== t.title ? ` · ${l.topicTitle}` : ""}
                                    </span>
                                  </span>
                                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                                </Link>
                              </li>
                            );
                          })}
                        </ol>
                      ) : null}
                    </div>
                  );
                })}
              </section>
            ))}

            {q && shown.length === 0 ? <p className="text-muted-foreground">Nothing matches &ldquo;{query.trim()}&rdquo; yet.</p> : null}

            {comingSoon.length > 0 && !q ? (
              <p className="rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">
                Coming soon: {comingSoon.join(", ")}. Notes appear here as soon as they are published.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

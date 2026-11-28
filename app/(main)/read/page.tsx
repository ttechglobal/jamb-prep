"use client";

import Link from "next/link";
import { BookOpen, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SubjectIcon } from "@/components/game/game-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppState } from "@/lib/app-state";
import { SUBJECTS } from "@/lib/catalog";
import { getReadCatalogue } from "@/lib/read/client";
import type { ReadCatalogue } from "@/lib/read/types";
import { cn } from "@/lib/utils";

/** Short notes by topic. Whatever EXL Learn has published is here: subjects, topics and lessons appear on their own. */
export default function ReadPage() {
  const { profile } = useAppState();
  const [catalogue, setCatalogue] = useState<ReadCatalogue | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getReadCatalogue()
      .then((c) => live && setCatalogue(c))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

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

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Read</h1>
      <p className="mt-0.5 text-muted-foreground">Short notes by topic. Read, then practise.</p>

      {catalogue === null && !failed ? (
        <div className="mt-5 space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : null}

      {failed ? <p className="mt-6 text-muted-foreground">Couldn&apos;t load the notes. Check your connection and try again.</p> : null}

      {catalogue && subjects.length === 0 ? (
        <div className="game-card mt-5 p-5 text-center">
          <BookOpen className="mx-auto size-8 text-sky" aria-hidden />
          <p className="mt-2 font-display text-lg font-semibold">Notes are on their way</p>
          <p className="text-sm text-muted-foreground">New topics are added all the time. Check back soon.</p>
        </div>
      ) : null}

      {subjects.length > 0 ? (
        <>
          <label className="relative mt-4 block">
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
            <div role="group" aria-label="Subject" className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {subjects.map((s) => (
                <button
                  key={s.slug}
                  type="button"
                  aria-pressed={s.slug === active}
                  onClick={() => setPicked(s.slug)}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center gap-2 rounded-xl border-2 px-3 font-display text-sm font-semibold",
                    s.slug === active ? "border-primary bg-secondary text-primary" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {s.subjectId ? <SubjectIcon id={s.subjectId} className="size-6 rounded-md" iconClassName="size-3.5" /> : null}
                  {s.name}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-5">
            {shown.map((s) => (
              <section key={s.slug} aria-label={s.name}>
                {q ? <h2 className="mb-2 font-display text-lg font-semibold">{s.name}</h2> : null}
                <div className="flex flex-col gap-4">
                  {s.topics.map((t) => (
                    <div key={t.id}>
                      <h3 className="mb-1.5 font-display text-sm font-semibold tracking-wide text-muted-foreground">{t.title.toUpperCase()}</h3>
                      <ul className="flex flex-col gap-2">
                        {t.lessons.map((l) => (
                          <li key={l.id}>
                            <Link href={`/read/${l.id}`} className="game-card game-tap flex items-center gap-3 p-3.5">
                              <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-soft text-sky">
                                <BookOpen className="size-5" strokeWidth={2.3} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block font-display text-[1.05rem] leading-tight font-semibold">{l.title}</span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  {l.minutes ? `${l.minutes} min read` : "Short read"}
                                  {l.topicTitle && l.topicTitle !== t.title ? ` · ${l.topicTitle}` : ""}
                                </span>
                              </span>
                              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ))}
            {q && shown.length === 0 ? <p className="text-muted-foreground">Nothing matches &ldquo;{query.trim()}&rdquo; yet.</p> : null}
          </div>

          {comingSoon.length > 0 && !q ? (
            <p className="mt-6 rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">
              Coming soon: {comingSoon.join(", ")}. Notes appear here as soon as they are published.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

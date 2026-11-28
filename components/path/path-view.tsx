"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Clock, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Meter, SubjectIcon } from "@/components/game/game-ui";
import { CheckNode, PathNode } from "@/components/path/path-node";
import { UnitSheet, type SheetTarget } from "@/components/path/unit-sheet";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStartSession } from "@/hooks/use-start-session";
import { track } from "@/lib/analytics";
import { useAppState } from "@/lib/app-state";
import { SUBJECTS } from "@/lib/catalog";
import { quickFive } from "@/lib/engine/presets";
import { getPath, getPathOverview, setPathPrefs } from "@/lib/path/client";
import { buildSections, isStarted, nextUnit, orderUnits } from "@/lib/path/layout";
import type { PathData, PathOrder, PathOverview, PathUnit } from "@/lib/path/types";
import { cn } from "@/lib/utils";

/** Sideways wiggle for the trail, in pixels, repeating every four nodes. */
const WIGGLE = [0, 52, 0, -52];

const BANNER = [
  "bg-violet border-[#4C1D95]",
  "bg-sky border-[#075985]",
  "bg-primary border-primary-edge",
];

function unitTarget(ordered: PathUnit[], index: number): SheetTarget {
  const unit = ordered[index];
  const total = ordered.reduce((sum, u) => sum + u.questionCount, 0);
  return { kind: "unit", unit, number: index + 1, share: unit.questionCount ? Math.round(total / unit.questionCount) : 0 };
}

/** A student's trail for each of their subjects. Practice stays one tap away: this is a second way in. */
export function PathView() {
  const { profile } = useAppState();
  const params = useSearchParams();
  const subjects = profile?.subjectIds ?? [];
  const [overview, setOverview] = useState<PathOverview | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getPathOverview()
      .then((o) => live && setOverview(o))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const hasPath = (id: string) => overview?.subjects.some((s) => s.subjectId === id) ?? false;
  const fromUrl = params.get("s");
  const subjectId =
    picked ?? (fromUrl && subjects.includes(fromUrl) ? fromUrl : null) ?? subjects.find(hasPath) ?? subjects[0] ?? null;

  if (!profile || !subjectId) return null;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Your path</h1>
      <p className="mt-0.5 text-muted-foreground">Go topic by topic. Earn stars as you go.</p>

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Subjects">
        {subjects.map((id) => {
          const subject = SUBJECTS.find((s) => s.id === id);
          const active = id === subjectId;
          const soon = overview !== null && !hasPath(id);
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPicked(id)}
              className={cn(
                "flex h-11 shrink-0 items-center gap-1.5 rounded-2xl border-2 border-b-4 bg-card pr-3 pl-2 font-display font-semibold transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active && "border-violet bg-violet-soft text-[#4C1D95]",
              )}
            >
              <SubjectIcon id={id} className="size-7 rounded-lg" iconClassName="size-4" />
              {subject?.shortName}
              {soon ? <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">Soon</span> : null}
            </button>
          );
        })}
      </div>

      <SubjectPath key={subjectId} subjectId={subjectId} openId={params.get("open")} />
    </div>
  );
}

function SubjectPath({ subjectId, openId }: { subjectId: string; openId: string | null }) {
  const { start, starting } = useStartSession();
  const [data, setData] = useState<PathData | null>(null);
  const [failed, setFailed] = useState(false);
  const [order, setOrder] = useState<PathOrder>("asked");
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const subject = SUBJECTS.find((s) => s.id === subjectId);

  useEffect(() => {
    let live = true;
    getPath(subjectId)
      .then((d) => {
        if (!live) return;
        const initial = d.prefs.order ?? "asked";
        setData(d);
        setOrder(initial);
        void track("path_view", { subject: subjectId, units: d.units.length });
        // Home's Continue button opens that unit's sheet straight away.
        if (openId) {
          const list = orderUnits(d.units, initial);
          const i = list.findIndex((u) => u.id === openId);
          if (i >= 0) setSheet(unitTarget(list, i));
        }
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
    // The sheet to open is only read once, when the path first loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  const sections = useMemo(() => (data ? buildSections(data.units, order, data.checkpoints) : []), [data, order]);
  const ordered = useMemo(() => (data ? orderUnits(data.units, order) : []), [data, order]);
  const next = data ? nextUnit(data.units, order) : null;

  function chooseOrder(next: PathOrder) {
    if (next === order) return;
    setOrder(next);
    void setPathPrefs(null, next).catch(() => {});
  }

  function begin() {
    if (!sheet) return;
    if (sheet.kind === "unit") {
      start({ mode: "subject", subjectIds: [subjectId], unitId: sheet.unit.id, count: 10, feedback: "instant" });
    } else {
      void track("path_check_started", { subject: subjectId });
      start({ mode: "subject", subjectIds: [subjectId], unitIds: sheet.unitIds, checkpoint: true, count: 10, feedback: "instant" });
    }
  }

  if (failed) {
    return <p className="mt-6 rounded-2xl bg-danger-soft p-4 text-sm">Couldn&apos;t load this path. Check your connection and refresh.</p>;
  }
  if (!data) {
    return (
      <div className="mt-4 space-y-3" aria-busy="true" aria-label="Loading your path">
        <Skeleton className="h-36 rounded-3xl" />
        <Skeleton className="h-16 rounded-3xl" />
        <Skeleton className="mx-auto size-20 rounded-full" />
      </div>
    );
  }

  if (data.units.length === 0) {
    return (
      <section className="game-card mt-4 p-5 text-center">
        <span aria-hidden className="mx-auto grid size-[4.5rem] place-items-center rounded-full border-b-[6px] border-[#CBD5CE] bg-muted text-muted-foreground">
          <Clock className="size-8" />
        </span>
        <h2 className="mt-3.5 font-display text-2xl font-semibold leading-tight">{subject?.name} path is coming</h2>
        <p className="mt-2 text-sm leading-snug text-muted-foreground">
          This subject needs its questions sorted by topic first, and we are working on it. Until then, practise {subject?.shortName} the usual ways.
          Your answers will count toward the path when it opens.
        </p>
        <div className="mt-4 flex flex-col gap-2.5">
          <button
            type="button"
            disabled={starting}
            onClick={() => start(quickFive([subjectId]))}
            className={buttonVariants({ variant: "gold", size: "xl", className: "w-full" })}
          >
            Quick Five in {subject?.shortName}
          </button>
          <Link href={`/practice/subject?s=${subjectId}`} className={buttonVariants({ variant: "outline", size: "xl", className: "w-full" })}>
            Choose a topic
          </Link>
        </div>
      </section>
    );
  }

  const stars = data.units.reduce((sum, u) => sum + u.stars, 0);
  const started = data.units.filter(isStarted).length;
  let counter = 0;

  return (
    <>
      <section aria-label={`${subject?.name} summary`} className="game-card mt-4 p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-semibold leading-tight">{subject?.name}</h2>
            <p className="text-sm text-muted-foreground">
              {started} of {data.units.length} topics started
            </p>
          </div>
          <p className="flex items-center gap-1 font-display text-xl font-semibold text-gold-ink">
            <Star className="size-5 fill-gold text-gold-edge" aria-hidden />
            {stars}
            <span className="text-sm font-medium text-muted-foreground">/ {data.units.length * 3}</span>
          </p>
        </div>
        <Meter percent={(stars / (data.units.length * 3)) * 100} label="Stars earned" className="mt-3" />
        <div role="group" aria-label="Order" className="mt-3.5 grid grid-cols-2 rounded-xl bg-muted p-0.5">
          {(
            [
              ["asked", "Most asked first"],
              ["syllabus", "Syllabus order"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={order === value}
              onClick={() => chooseOrder(value)}
              className={cn(
                "rounded-[0.6rem] py-2 font-display text-sm font-semibold transition",
                order === value ? "bg-card shadow-[0_2px_0_0_var(--border)]" : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {order === "asked" ? "Ordered by how often JAMB asks them." : "Ordered as the syllabus teaches them."} Everything is open. Next up is only a suggestion.
        </p>
      </section>

      {sections.map((section) => (
        <section key={section.index} aria-label={section.title} className="mt-5">
          <div className={cn("flex items-center gap-3 rounded-3xl border-b-[6px] px-4 py-3.5 text-white", BANNER[section.index % BANNER.length])}>
            <div className="flex-1">
              <p className="font-display text-xs font-semibold tracking-wide text-white/80">SECTION {section.index + 1}</p>
              <h2 className="font-display text-xl leading-tight font-semibold">{section.title}</h2>
            </div>
            <p className="text-sm font-semibold text-white/90">
              {section.units.filter(isStarted).length} of {section.units.length} started
            </p>
          </div>

          <ol className="relative mt-3 flex flex-col gap-3 py-1">
            <span aria-hidden className="absolute inset-y-6 left-1/2 -translate-x-1/2 border-l-4 border-dotted border-[#CBD5CE]" />
            {section.units.map((unit) => {
              const i = counter++;
              return (
                <PathNode
                  key={unit.id}
                  unit={unit}
                  number={i + 1}
                  isNext={next?.id === unit.id}
                  offset={WIGGLE[i % WIGGLE.length]}
                  onOpen={() => {
                    void track("path_unit_open", { subject: subjectId, unit: unit.slug });
                    setSheet(unitTarget(ordered, i));
                  }}
                />
              );
            })}
            {section.check ? (
              <CheckNode
                offset={0}
                done={section.check.done}
                onOpen={() =>
                  setSheet({
                    kind: "check",
                    unitIds: section.check!.unitIds,
                    names: section.units.map((u) => u.name),
                  })
                }
              />
            ) : null}
          </ol>
        </section>
      ))}

      <UnitSheet target={sheet} starting={starting} onStart={begin} onClose={() => setSheet(null)} />
    </>
  );
}

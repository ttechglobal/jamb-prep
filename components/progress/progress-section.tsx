"use client";

import { Flame } from "lucide-react";
import { LevelBar, SubjectIcon } from "@/components/game/game-ui";
import { ActivityChart } from "@/components/progress/activity-chart";
import { WorkOnThis } from "@/components/practice/work-on-this";
import { useAppState } from "@/lib/app-state";
import { SUBJECTS } from "@/lib/catalog";
import { liveStreak } from "@/lib/game/rules";

/** A plain look at how practice has been going. No scores or grades, just habits and what to work on. */
export function ProgressSection() {
  const { profile, progress } = useAppState();
  if (!profile) return null;

  const stats: [string, number][] = [
    ["Rounds", progress.sessionsCompleted],
    ["Questions", progress.questionsAnswered],
    ["Best streak", progress.bestStreak],
  ];

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      <div className="flex flex-col gap-4">
        <section aria-label="Your stats" className="game-card p-4">
          <LevelBar xp={progress.xp} />
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-flame-soft p-3 text-flame">
            <Flame className="size-7" aria-hidden />
            <p className="font-display text-xl font-semibold leading-none">
              {liveStreak(progress)} <span className="text-sm font-medium">day streak</span>
            </p>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 border-t-2 pt-3 text-center">
            {stats.map(([label, value]) => (
              <div key={label}>
                <dd className="font-display text-xl font-semibold">{value}</dd>
                <dt className="text-xs text-muted-foreground">{label}</dt>
              </div>
            ))}
          </dl>
        </section>

        <ActivityChart />
      </div>

      <div className="flex flex-col gap-4">
        <WorkOnThis />

        <section aria-labelledby="subjects-title" className="game-card p-4">
          <h2 id="subjects-title" className="font-display text-lg font-semibold">
            Questions by subject
          </h2>
          <ul className="mt-3 flex flex-col gap-2.5">
            {profile.subjectIds.map((id) => (
              <li key={id} className="flex items-center gap-3">
                <SubjectIcon id={id} className="size-9 rounded-lg" iconClassName="size-4" />
                <span className="min-w-0 flex-1 truncate font-medium">{SUBJECTS.find((s) => s.id === id)?.name}</span>
                <span className="font-display font-semibold">{progress.subjects[id]?.answered ?? 0}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

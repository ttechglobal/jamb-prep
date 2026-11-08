"use client";

import { useSearchParams } from "next/navigation";
import { BookOpenCheck } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { SubjectIcon } from "@/components/game/game-ui";
import { ChoiceChips } from "@/components/practice/choice-chips";
import { SetupShell } from "@/components/practice/setup-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { useStartSession } from "@/hooks/use-start-session";
import { useAppState } from "@/lib/app-state";
import { data } from "@/lib/data";
import { subjectPractice } from "@/lib/engine/presets";
import { SUBJECTS } from "@/lib/catalog";
import type { Topic } from "@/lib/types";

const ALL = "__all__";
const COUNTS = [5, 10, 20];

export default function SubjectSetupPage() {
  return (
    <Suspense>
      <SubjectSetup />
    </Suspense>
  );
}

function SubjectSetup() {
  const preselected = useSearchParams().get("s");
  const { profile } = useAppState();
  const { start, starting } = useStartSession();
  const subjects = profile ? SUBJECTS.filter((s) => profile.subjectIds.includes(s.id)) : SUBJECTS;

  const [subjectId, setSubjectId] = useState<string | null>(SUBJECTS.some((s) => s.id === preselected) ? preselected : null);
  const [topicId, setTopicId] = useState<string>(ALL);
  const [count, setCount] = useState(10);
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [available, setAvailable] = useState<number | null>(null);

  useEffect(() => {
    if (!subjectId) return;
    let cancelled = false;
    data.listTopics(subjectId).then((t) => {
      if (!cancelled) setTopics(t);
    });
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  useEffect(() => {
    if (!subjectId) return;
    let cancelled = false;
    data.countQuestions(subjectId, topicId === ALL ? null : topicId).then((n) => {
      if (!cancelled) setAvailable(n);
    });
    return () => {
      cancelled = true;
    };
  }, [subjectId, topicId]);

  const effectiveCount = available === null ? count : Math.min(count, available);

  return (
    <SetupShell
      title="Subject Practice"
      badge={<span className="grid size-13 shrink-0 place-items-center rounded-2xl bg-sky-soft text-sky"><BookOpenCheck className="size-7" strokeWidth={2.4} aria-hidden /></span>}
      description="Answer questions one at a time and see the explanation straight away."
      canStart={!!subjectId && (available ?? 0) > 0}
      starting={starting}
      onStart={() => subjectId && start(subjectPractice(subjectId, topicId === ALL ? null : topicId, effectiveCount))}
      startLabel={subjectId ? `Start ${effectiveCount} questions` : "Choose a subject"}
      footerNote={available === 0 ? "No questions for this topic yet. Try All topics." : undefined}
    >
      <ChoiceChips
        label="Subject"
        columns="list"
        value={subjectId}
        onChange={(id) => {
          setSubjectId(id);
          setTopicId(ALL);
          setTopics(null);
          setAvailable(null);
        }}
        choices={subjects.map((s) => ({ value: s.id, label: s.name, icon: <SubjectIcon id={s.id} /> }))}
      />

      {subjectId ? (
        <ChoiceChips
          label="Questions"
          value={count}
          onChange={setCount}
          choices={COUNTS.map((n) => ({ value: n, label: String(n) }))}
        />
      ) : null}

      {subjectId ? (
        topics ? (
          <ChoiceChips
            label="Topic"
            value={topicId}
            onChange={setTopicId}
            choices={[{ value: ALL, label: "All topics" }, ...topics.map((t) => ({ value: t.id, label: t.name }))]}
          />
        ) : (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-4 w-16" />
            <div className="flex gap-2">
              <Skeleton className="h-11 w-24 rounded-xl" />
              <Skeleton className="h-11 w-32 rounded-xl" />
              <Skeleton className="h-11 w-28 rounded-xl" />
            </div>
          </div>
        )
      ) : null}

    </SetupShell>
  );
}

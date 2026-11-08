"use client";

import { Clock } from "lucide-react";
import { useState } from "react";
import { SubjectIcon } from "@/components/game/game-ui";
import { ChoiceChips } from "@/components/practice/choice-chips";
import { SetupShell } from "@/components/practice/setup-shell";
import { useStartSession } from "@/hooks/use-start-session";
import { useAppState } from "@/lib/app-state";
import { TIMED_PRESETS } from "@/lib/exam-format";
import { timedPractice } from "@/lib/engine/presets";
import { SUBJECTS } from "@/lib/catalog";

export default function TimedSetupPage() {
  const { profile } = useAppState();
  const { start, starting } = useStartSession();
  const subjects = profile ? SUBJECTS.filter((s) => profile.subjectIds.includes(s.id)) : SUBJECTS;

  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [count, setCount] = useState<number>(TIMED_PRESETS.defaultCount);
  const [minutes, setMinutes] = useState<number>(TIMED_PRESETS.defaultDurationMin);
  const secPerQ = Math.round((minutes * 60) / count);

  return (
    <SetupShell
      title="Timed Practice"
      badge={<span className="grid size-13 shrink-0 place-items-center rounded-2xl bg-flame-soft text-flame"><Clock className="size-7" strokeWidth={2.4} aria-hidden /></span>}
      description="Work against the clock. Answers and explanations are shown at the end."
      canStart={!!subjectId}
      starting={starting}
      onStart={() => subjectId && start(timedPractice(subjectId, count, minutes))}
      startLabel={subjectId ? `Start · ${count} questions in ${minutes} min` : "Choose a subject"}
      footerNote={`About ${secPerQ}s per question. In the real UTME you get about 40s per question.`}
    >
      <ChoiceChips
        label="Subject"
        columns="list"
        value={subjectId}
        onChange={setSubjectId}
        choices={subjects.map((s) => ({ value: s.id, label: s.name, icon: <SubjectIcon id={s.id} /> }))}
      />
      <ChoiceChips
        label="Questions"
        value={count}
        onChange={setCount}
        choices={TIMED_PRESETS.counts.map((n) => ({ value: n, label: String(n) }))}
      />
      <ChoiceChips
        label="Time limit"
        value={minutes}
        onChange={setMinutes}
        choices={TIMED_PRESETS.durationsMin.map((n) => ({ value: n, label: `${n} min` }))}
      />
    </SetupShell>
  );
}

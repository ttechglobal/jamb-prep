"use client";

import { Info, Trophy } from "lucide-react";
import { SubjectIcon } from "@/components/game/game-ui";
import { SetupShell } from "@/components/practice/setup-shell";
import { useStartSession } from "@/hooks/use-start-session";
import { useAppState } from "@/lib/app-state";
import { UTME_FORMAT } from "@/lib/exam-format";
import { mockExam } from "@/lib/engine/presets";
import { SUBJECTS } from "@/lib/catalog";

export default function MockSetupPage() {
  const { profile } = useAppState();
  const { start, starting } = useStartSession();

  const config = profile ? mockExam(profile.subjectIds) : null;
  const rows = (config?.subjectIds ?? []).map((id) => ({
    id,
    name: SUBJECTS.find((s) => s.id === id)?.name ?? id,
    count: id === UTME_FORMAT.compulsorySubjectSlug ? UTME_FORMAT.compulsoryQuestionCount : UTME_FORMAT.otherQuestionCount,
  }));

  return (
    <SetupShell
      title="UTME Mock Exam"
      badge={<span className="grid size-13 shrink-0 place-items-center rounded-2xl bg-violet-soft text-violet"><Trophy className="size-7" strokeWidth={2.4} aria-hidden /></span>}
      description="A full computer-based test using your four subjects, timed like the real exam."
      canStart={!!config}
      starting={starting}
      onStart={() => config && start(config)}
      startLabel="Start mock exam"
      footerNote="The timer starts as soon as you begin and keeps running if you leave."
    >
      <div className="game-card overflow-hidden">
        <table className="w-full text-sm">
          <caption className="sr-only">Mock exam structure</caption>
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold">Subject</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">Questions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2.5 font-medium"><span className="flex items-center gap-3"><SubjectIcon id={r.id} className="size-9" />{r.name}</span></td>
                <td className="px-4 py-3 text-right tabular-nums">{r.count}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-muted/30 font-semibold">
            <tr>
              <td className="px-4 py-3">Total · {UTME_FORMAT.durationSec / 60} minutes</td>
              <td className="px-4 py-3 text-right tabular-nums">{config?.count ?? 0}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <ul className="space-y-2 text-sm text-muted-foreground">
        <li>• Move freely between questions and subjects, and change answers until you submit.</li>
        <li>• Each subject is scored out of 100, for a total out of 400.</li>
        <li>• Unanswered questions score zero, so answer every question.</li>
      </ul>

      <p className="flex gap-2 rounded-xl bg-warning-soft p-3 text-sm text-gold-ink">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          This is a practice simulation. Your mock score is not a prediction of your actual UTME result.
        </span>
      </p>
    </SetupShell>
  );
}

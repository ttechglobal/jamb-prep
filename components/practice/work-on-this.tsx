"use client";

import { Loader2, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { SubjectIcon } from "@/components/game/game-ui";
import { Button } from "@/components/ui/button";
import { useStartSession } from "@/hooks/use-start-session";
import { MINUTE, cached } from "@/lib/cache";
import { track } from "@/lib/analytics";
import { useAppState } from "@/lib/app-state";
import { SUBJECTS } from "@/lib/catalog";
import { subjectPractice } from "@/lib/engine/presets";
import { supabase } from "@/lib/supabase/client";

type Trend = {
  topicId: string;
  topicName: string;
  subjectId: string;
  status: "work_on" | "improving";
  frequent: boolean;
};

const PRACTICE_COUNT = 10;

/**
 * A plain read of the last two weeks: topics to work on, and topics that are picking up. It never
 * shows scores, and it stays out of the way (renders nothing) until there is something to say.
 */
export function WorkOnThis() {
  const { isGuest } = useAppState();
  const { start, starting } = useStartSession();
  const [trends, setTrends] = useState<Trend[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    if (isGuest) return;
    let live = true;
    cached("user:trends", 5 * MINUTE, async () => {
      const { data, error } = await supabase().rpc("get_topic_trends");
      if (error) throw error;
      return Array.isArray(data) ? (data as Trend[]) : [];
    })
      .then((data) => {
        if (!live || data.length === 0) return;
        setTrends(data);
        void track("needs_work_shown", { count: data.length });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [isGuest]);

  if (trends.length === 0) return null;

  return (
    <section aria-labelledby="work-on-title" className="order-3 game-card p-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="size-5 text-primary" aria-hidden />
        <h2 id="work-on-title" className="font-display text-lg font-semibold">
          From your recent practice
        </h2>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {trends.map((t) => {
          const subject = SUBJECTS.find((s) => s.id === t.subjectId);
          const busy = starting && chosen === t.topicId;
          return (
            <li key={t.topicId} className="flex items-center gap-3 rounded-xl border-2 p-2.5">
              <SubjectIcon id={t.subjectId} className="size-9 rounded-lg" iconClassName="size-4" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight">{t.topicName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {subject?.shortName} ·{" "}
                  {t.status === "improving" ? "You're improving here" : t.frequent ? "Work on this. It comes up often" : "Work on this"}
                </p>
              </div>
              <Button
                variant="outline"
                size="lg"
                disabled={starting}
                aria-label={`Practise ${t.topicName}`}
                onClick={() => {
                  setChosen(t.topicId);
                  void track("needs_work_tapped", { status: t.status, frequent: t.frequent });
                  start(subjectPractice(t.subjectId, t.topicId, PRACTICE_COUNT));
                }}
              >
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : "Practise"}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

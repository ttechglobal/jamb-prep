import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/gate";
import { ago, formatDate, PeriodNav, periodFrom, Stat, Th } from "@/components/admin/period-nav";
import { adminDb } from "@/lib/admin/auth";
import { SUBJECTS } from "@/lib/catalog";
import { MODE_LABEL } from "@/lib/engine/presets";

interface Detail {
  days: number;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    joined: string;
    last_sign_in: string | null;
    target: number | null;
    xp: number;
    streak: number;
    best_streak: number;
    sessions: number;
    questions: number;
    last_practice_day: string | null;
    subjects: Record<string, { answered: number; correct: number }>;
    chosen: string[];
    reminders: boolean;
  };
  daily: { day: string; rounds: number }[];
  recent: { mode: string; status: string; started_at: string; total: number; answered: number | null; accuracy: number | null; utme_score: number | null }[];
}

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ days?: string }> };
const subjectName = (id: string) => SUBJECTS.find((s) => s.id === id)?.shortName ?? id;
const STATUS: Record<string, string> = { in_progress: "Not finished", submitted: "Finished", expired: "Timed out", abandoned: "Left" };

export default function AdminUserPage(props: Props) {
  return (
    <AdminPage>
      <UserData {...props} />
    </AdminPage>
  );
}

async function UserData({ params, searchParams }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const days = periodFrom((await searchParams).days);
  const { data, error } = await adminDb().rpc("admin_user_detail", { p_user: id, p_days: days });
  if (error?.message?.includes("not_found")) notFound();
  if (error || !data) return <p role="alert">Couldn&apos;t load this student. Refresh to try again.</p>;
  const { user: u, daily, recent } = data as Detail;
  const rounds = daily.reduce((n, d) => n + d.rounds, 0);
  const perSubject = Object.entries(u.subjects)
    .map(([subject, v]) => ({ subject, ...v, accuracy: v.answered ? Math.round((v.correct / v.answered) * 100) : 0 }))
    .sort((a, b) => b.answered - a.answered);

  return (
    <div className="space-y-5">
      <Link href={`/admin/users?days=${days}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
        <ArrowLeft className="size-4" aria-hidden /> All users
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{u.name ?? "No name"}</h1>
          <p className="text-muted-foreground">
            {u.email ?? "No email"} · joined {formatDate(u.joined)} · last signed in {ago(u.last_sign_in)}
          </p>
        </div>
        <PeriodNav href={`/admin/users/${u.id}`} days={days} />
      </div>

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Rounds" value={rounds} note={`last ${days} days`} />
        <Stat label="Questions answered" value={u.questions} note={`${u.sessions} rounds in all`} />
        <Stat label="XP" value={u.xp} />
        <Stat label="Streak" value={u.streak} note={`best ${u.best_streak}`} />
        <Stat label="Target" value={u.target ?? "None"} note={`Reminders ${u.reminders ? "on" : "off"}`} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="game-card p-4" aria-labelledby="subj-t">
          <h2 id="subj-t" className="text-lg font-semibold">Subjects</h2>
          {u.chosen.length ? <p className="text-sm text-muted-foreground">Chose: {u.chosen.map(subjectName).join(", ")}</p> : null}
          {perSubject.length ? (
            <ul className="mt-3 space-y-3">
              {perSubject.map((s) => (
                <li key={s.subject}>
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="font-semibold">{subjectName(s.subject)}</span>
                    <span className="ml-auto text-muted-foreground">
                      {s.correct} of {s.answered} right ({s.accuracy}%)
                    </span>
                  </div>
                  <div className="mt-1 h-3 rounded-full bg-muted">
                    <div className="h-3 rounded-full bg-primary" style={{ width: `${s.accuracy}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-muted-foreground">No questions answered yet.</p>
          )}
        </section>

        <section className="game-card p-4" aria-labelledby="days-t">
          <h2 id="days-t" className="text-lg font-semibold">Days practised</h2>
          {daily.length ? (
            <ul className="mt-2 divide-y text-sm">
              {[...daily].reverse().slice(0, 14).map((d) => (
                <li key={d.day} className="flex justify-between py-1.5">
                  <span>{formatDate(d.day)}</span>
                  <span className="font-semibold">
                    {d.rounds} {d.rounds === 1 ? "round" : "rounds"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-muted-foreground">No rounds in this period.</p>
          )}
        </section>
      </div>

      <section className="game-card overflow-x-auto" aria-labelledby="recent-t">
        <h2 id="recent-t" className="px-4 pt-4 text-lg font-semibold">Latest rounds</h2>
        {recent.length ? (
          <table className="mt-2 w-full min-w-[34rem] text-left text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                <Th>When</Th>
                <Th>Type</Th>
                <Th>Result</Th>
                <Th right>Answered</Th>
                <Th right>Score</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recent.map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">{ago(r.started_at)}</td>
                  <td className="px-3 py-2">{MODE_LABEL[r.mode as keyof typeof MODE_LABEL] ?? r.mode}</td>
                  <td className="px-3 py-2">{STATUS[r.status] ?? r.status}</td>
                  <td className="px-3 py-2 text-right">
                    {r.answered ?? 0} of {r.total}
                  </td>
                  <td className="px-3 py-2 text-right">{r.utme_score !== null ? `${r.utme_score}/400` : r.accuracy !== null ? `${r.accuracy}%` : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-4 text-muted-foreground">No rounds yet.</p>
        )}
      </section>
    </div>
  );
}

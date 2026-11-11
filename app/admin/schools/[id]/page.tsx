import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/gate";
import { ago, formatDate, PeriodNav, periodFrom, Stat, Th } from "@/components/admin/period-nav";
import { adminDb } from "@/lib/admin/auth";
import { SUBJECTS } from "@/lib/catalog";
import { MODE_LABEL } from "@/lib/engine/presets";

interface Detail {
  school: { id: string; name: string; state: string; area: string; phone: string; created_at: string; last_seen_at: string | null };
  devices: { id: string; label: string; os: string | null; app_version: string | null; last_seen_at: string | null }[];
  daily: { day: string; sessions: number; questions: number; devices: number }[];
  subjects: { subject: string; sessions: number; answered: number; correct: number }[];
  modes: { mode: string; sessions: number }[];
  sessions: { started: number; completed: number; abandoned: number };
  weak_topics: { topic: string; answered: number; accuracy: number }[];
  downloads: { done: number; failed: number };
}

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ days?: string }> };
const subjectName = (id: string) => SUBJECTS.find((s) => s.id === id)?.shortName ?? id;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export default function AdminSchoolPage(props: Props) {
  return (
    <AdminPage>
      <SchoolData {...props} />
    </AdminPage>
  );
}

async function SchoolData({ params, searchParams }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const days = periodFrom((await searchParams).days);
  const { data, error } = await adminDb().rpc("admin_school_detail", { p_school: id, p_days: days });
  if (error?.message?.includes("not_found")) notFound();
  if (error || !data) return <p role="alert">Couldn&apos;t load this school. Refresh to try again.</p>;
  const d = data as Detail;
  const s = d.school;
  const questions = d.daily.reduce((n, x) => n + x.questions, 0);

  return (
    <div className="space-y-5">
      <Link href={`/admin/schools?days=${days}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
        <ArrowLeft className="size-4" aria-hidden /> All schools
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{s.name}</h1>
          <p className="text-muted-foreground">
            {s.area}, {s.state} · {s.phone} · registered {formatDate(s.created_at)} · last seen {ago(s.last_seen_at)}
          </p>
        </div>
        <PeriodNav href={`/admin/schools/${s.id}`} days={days} />
      </div>

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Computers" value={d.devices.length} />
        <Stat label="Rounds finished" value={d.sessions.completed} note={`${d.sessions.started} started · ${pct(d.sessions.completed, d.sessions.started)}% finished`} />
        <Stat label="Questions answered" value={questions} note={`last ${days} days`} />
        <Stat label="Active days" value={d.daily.length} note={`of the last ${days}`} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="game-card p-4" aria-labelledby="subj-t">
          <h2 id="subj-t" className="text-lg font-semibold">What they practise</h2>
          {d.subjects.length ? (
            <ul className="mt-3 space-y-3">
              {d.subjects.map((x) => (
                <li key={x.subject}>
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="font-semibold">{subjectName(x.subject)}</span>
                    <span className="ml-auto text-muted-foreground">
                      {x.sessions} rounds · {pct(x.correct, x.answered)}% right
                    </span>
                  </div>
                  <div className="mt-1 h-3 rounded-full bg-muted">
                    <div className="h-3 rounded-full bg-primary" style={{ width: `${pct(x.sessions, d.subjects[0].sessions)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-muted-foreground">No finished rounds in this period.</p>
          )}
          {d.modes.length ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {d.modes.map((m) => `${MODE_LABEL[m.mode as keyof typeof MODE_LABEL] ?? m.mode}: ${m.sessions}`).join(" · ")}
            </p>
          ) : null}
        </section>

        <section className="game-card p-4" aria-labelledby="weak-t">
          <h2 id="weak-t" className="text-lg font-semibold">Weakest topics</h2>
          <p className="text-sm text-muted-foreground">Topics with 20 or more answers, lowest score first.</p>
          {d.weak_topics.length ? (
            <ul className="mt-2 divide-y text-sm">
              {d.weak_topics.map((t) => (
                <li key={t.topic} className="flex justify-between gap-3 py-1.5">
                  <span>{t.topic}</span>
                  <span className="shrink-0 font-semibold">
                    {t.accuracy}% <span className="font-normal text-muted-foreground">of {t.answered}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-muted-foreground">Not enough answers yet.</p>
          )}
        </section>
      </div>

      <section className="game-card overflow-x-auto" aria-labelledby="dev-t">
        <h2 id="dev-t" className="px-4 pt-4 text-lg font-semibold">Computers</h2>
        <table className="mt-2 w-full min-w-[32rem] text-left text-sm">
          <thead className="border-b text-muted-foreground">
            <tr>
              <Th>Name</Th>
              <Th>System</Th>
              <Th>App version</Th>
              <Th>Last seen</Th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {d.devices.map((v) => (
              <tr key={v.id}>
                <td className="px-3 py-2 font-semibold">{v.label}</td>
                <td className="px-3 py-2">{v.os ?? "–"}</td>
                <td className="px-3 py-2">{v.app_version ?? "–"}</td>
                <td className="px-3 py-2">{ago(v.last_seen_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {d.downloads.failed > 0 ? <p className="px-4 pb-3 pt-1 text-sm text-destructive">{d.downloads.failed} question pack download{d.downloads.failed === 1 ? "" : "s"} failed in this period.</p> : null}
      </section>
    </div>
  );
}

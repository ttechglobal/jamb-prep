import Link from "next/link";
import { AdminPage } from "@/components/admin/gate";
import { adminDb } from "@/lib/admin/auth";
import { cn } from "@/lib/utils";

interface Topic {
  topic_id: string;
  name: string;
  count: number;
  by_year: Record<string, number> | null;
}
interface SubjectFrequency {
  subject_id: string;
  total: number;
  tagged: number;
  first_year: number;
  last_year: number;
  years: { year: number; total: number }[];
  topics: Topic[];
}

const RECENT = 5;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export default function TopicFrequencyPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  return (
    <AdminPage>
      <Frequency searchParams={searchParams} />
    </AdminPage>
  );
}

async function Frequency({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const db = adminDb();
  const [freq, subjects] = await Promise.all([db.rpc("admin_topic_frequency"), db.from("subjects").select("id, name, sort_order").order("sort_order")]);
  if (freq.error || !freq.data) return <p role="alert">Couldn&apos;t load topic numbers. Refresh to try again.</p>;
  const all = freq.data as SubjectFrequency[];
  const names = new Map((subjects.data ?? []).map((s) => [s.id, s.name]));
  const list = all.sort((a, b) => (names.get(a.subject_id) ?? "").localeCompare(names.get(b.subject_id) ?? ""));
  const asked = (await searchParams).subject;
  const current = list.find((s) => s.subject_id === asked) ?? list[0];
  if (!current) return <p>No questions yet.</p>;

  const untagged = current.total - current.tagged;
  const years = current.years.map((y) => y.year);
  const recentYears = years.slice(-RECENT);
  const recentTotal = current.years.filter((y) => recentYears.includes(y.year)).reduce((n, y) => n + y.total, 0);
  const max = Math.max(1, ...current.topics.map((t) => t.count));
  const quiet = current.topics.filter((t) => recentYears.every((y) => !t.by_year?.[y]));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/questions" className="text-sm font-semibold text-primary underline-offset-2 hover:underline">
          ← Question coverage
        </Link>
        <h1 className="mt-1 text-3xl font-semibold">Topic frequency</h1>
        <p className="mt-1 text-muted-foreground">How often each topic has appeared in past papers. This is for our own analysis, and it counts only questions already tagged with a topic.</p>
      </div>

      <nav aria-label="Subject" className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
        {list.map((s) => (
          <Link
            key={s.subject_id}
            href={`/admin/questions/topics?subject=${s.subject_id}`}
            aria-current={s.subject_id === current.subject_id ? "page" : undefined}
            className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-muted-foreground aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-sm"
          >
            {names.get(s.subject_id) ?? s.subject_id}
          </Link>
        ))}
      </nav>

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Questions" value={current.total} note={`${current.first_year} to ${current.last_year}`} />
        <Stat label="With a topic" value={`${pct(current.tagged, current.total)}%`} note={`${current.tagged} of ${current.total}`} />
        <Stat label="Topics" value={current.topics.length} />
        <Stat label={`Last ${recentYears.length} years`} value={recentTotal} note="questions" />
      </section>

      {current.tagged === 0 ? (
        <section className="rounded-2xl border-2 border-gold/60 bg-gold-soft p-4 text-gold-ink" role="status">
          <p className="font-semibold">No questions here have a topic yet.</p>
          <p className="text-sm">Topic frequency can&apos;t be worked out until they are tagged.</p>
        </section>
      ) : (
        <>
          {untagged > 0 ? (
            <p className="text-sm text-muted-foreground">
              {untagged} of {current.total} questions ({pct(untagged, current.total)}%) have no topic and are left out of the counts below. Treat the shares as a guide, not an exact figure.
            </p>
          ) : null}

          <section className="game-card overflow-x-auto p-0" aria-label="Topics by frequency">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th scope="col" className="px-3 py-2 font-semibold">Topic</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Questions</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Share</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Years seen</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Last {recentYears.length}</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Year by year, {years[0]} to {years[years.length - 1]}</th>
                </tr>
              </thead>
              <tbody>
                {current.topics.map((t) => {
                  const seen = years.filter((y) => t.by_year?.[y]).length;
                  const recent = recentYears.reduce((n, y) => n + (t.by_year?.[y] ?? 0), 0);
                  return (
                    <tr key={t.topic_id} className="border-b last:border-b-0">
                      <th scope="row" className="px-3 py-2 text-left font-medium">
                        {t.name}
                        <div className="mt-1 h-1.5 w-40 max-w-full rounded-full bg-muted" aria-hidden>
                          <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(t.count / max) * 100}%` }} />
                        </div>
                      </th>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{t.count}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{pct(t.count, current.tagged)}%</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {seen} of {years.length}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{recent}</td>
                      <td className="px-3 py-2">
                        <Strip years={years} byYear={t.by_year ?? {}} name={t.name} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {quiet.length ? (
            <section className="game-card p-4" aria-labelledby="quiet-t">
              <h2 id="quiet-t" className="text-lg font-semibold">Quiet lately</h2>
              <p className="text-sm text-muted-foreground">
                No question on these in the last {recentYears.length} years of data ({recentYears[0]} to {recentYears[recentYears.length - 1]}):
              </p>
              <p className="mt-2 text-sm">{quiet.map((t) => `${t.name} (${t.count})`).join(", ")}</p>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

/** One small square per year, darker for more questions. Hover for the number. */
function Strip({ years, byYear, name }: { years: number[]; byYear: Record<string, number>; name: string }) {
  const peak = Math.max(1, ...years.map((y) => byYear[y] ?? 0));
  return (
    <div className="flex gap-px" role="img" aria-label={`${name} by year`}>
      {years.map((y) => {
        const n = byYear[y] ?? 0;
        return (
          <span
            key={y}
            title={`${y}: ${n}`}
            className={cn("h-5 w-2 rounded-[2px]", n ? "bg-primary" : "bg-muted")}
            style={n ? { opacity: 0.3 + 0.7 * (n / peak) } : undefined}
          />
        );
      })}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="game-card p-3">
      <p className="text-sm font-semibold leading-tight text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold leading-none">{value}</p>
      {note ? <p className="mt-1.5 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

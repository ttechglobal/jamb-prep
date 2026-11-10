import Link from "next/link";
import { AdminPage } from "@/components/admin/gate";
import { adminDb } from "@/lib/admin/auth";
import { JAMB_FIRST_YEAR, JAMB_LAST_YEAR, MYQUEST_SUBJECTS } from "@/lib/myquest/subjects";
import { cn } from "@/lib/utils";

interface Cell {
  subject_id: string;
  year: number;
  published: number;
  draft: number;
}
interface Staged {
  provider_subject: string;
  year: string;
  status: string;
  fetched: number;
}

const YEARS = Array.from({ length: JAMB_LAST_YEAR - JAMB_FIRST_YEAR + 1 }, (_, i) => JAMB_LAST_YEAR - i);

export default function QuestionCoveragePage() {
  return (
    <AdminPage>
      <Coverage />
    </AdminPage>
  );
}

async function Coverage() {
  const db = adminDb();
  const [coverage, subjects] = await Promise.all([db.rpc("admin_question_coverage"), db.from("subjects").select("id, name, sort_order").order("sort_order")]);
  if (coverage.error || !coverage.data) return <p role="alert">Couldn&apos;t load coverage. Refresh to try again.</p>;
  const { cells, staged } = coverage.data as { cells: Cell[]; staged: Staged[] };

  const have = new Map(cells.map((c) => [`${c.subject_id}:${c.year}`, c]));
  const fetched = new Map<string, Staged>();
  for (const s of staged) {
    const id = MYQUEST_SUBJECTS[s.provider_subject];
    if (id) fetched.set(`${id}:${s.year}`, s);
  }
  const rows = (subjects.data ?? []).filter((s) => cells.some((c) => c.subject_id === s.id));
  const total = cells.reduce((n, c) => n + c.published + c.draft, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold">Question coverage</h1>
        <p className="mt-1 text-muted-foreground">
          What the bank already holds for each subject and year, so a paper is never fetched twice. MyQuest charges for every page, so check here before fetching.
        </p>
      </div>

      <section aria-label="Legend" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <Key className="bg-primary/15 text-foreground" label="In the bank (number of questions)" />
        <Key className="bg-gold-soft text-gold-ink" label="Fetched, not in the bank yet" />
        <Key className="bg-muted text-muted-foreground" label="Nothing yet. A gap to fill" />
        <Link href="/admin/questions/topics" className="ml-auto font-semibold text-primary underline-offset-2 hover:underline">
          Topic frequency →
        </Link>
      </section>

      <section className="game-card overflow-x-auto p-0" aria-label="Questions by subject and year">
        <table className="w-full border-separate border-spacing-0 text-center text-sm tabular-nums">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 min-w-36 border-b bg-card px-3 py-2 text-left font-semibold">
                Subject
              </th>
              <th scope="col" className="border-b bg-card px-2 py-2 font-semibold">
                Total
              </th>
              {YEARS.map((y) => (
                <th key={y} scope="col" className="border-b bg-card px-1.5 py-2 font-medium text-muted-foreground">
                  {y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const sum = YEARS.reduce((n, y) => n + (have.get(`${s.id}:${y}`)?.published ?? 0) + (have.get(`${s.id}:${y}`)?.draft ?? 0), 0);
              return (
                <tr key={s.id}>
                  <th scope="row" className="sticky left-0 z-10 border-b bg-card px-3 py-1.5 text-left font-semibold">
                    {s.name}
                  </th>
                  <td className="border-b px-2 py-1.5 font-semibold">{sum}</td>
                  {YEARS.map((y) => {
                    const c = have.get(`${s.id}:${y}`);
                    const f = fetched.get(`${s.id}:${y}`);
                    const n = c ? c.published + c.draft : 0;
                    return (
                      <td key={y} className="border-b p-0.5">
                        <div
                          title={
                            n
                              ? `${s.name} ${y}: ${c!.published} published${c!.draft ? `, ${c!.draft} draft` : ""}`
                              : f
                                ? `${s.name} ${y}: ${f.fetched} fetched from MyQuest (${f.status}), not in the bank`
                                : `${s.name} ${y}: nothing yet`
                          }
                          className={cn(
                            "grid h-8 min-w-9 place-items-center rounded-md text-xs font-semibold",
                            n ? "bg-primary/15" : f ? "bg-gold-soft text-gold-ink" : "bg-muted text-muted-foreground/60",
                          )}
                        >
                          {n || (f ? f.fetched : "–")}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <p className="text-sm text-muted-foreground">
        {total.toLocaleString()} questions across {rows.length} subjects. Years run {JAMB_FIRST_YEAR} to {JAMB_LAST_YEAR}, the range MyQuest lists for JAMB. Drafts count as held, not live.
      </p>

      <Gaps rows={rows} have={have} fetched={fetched} />
    </div>
  );
}

function Gaps({ rows, have, fetched }: { rows: { id: string; name: string }[]; have: Map<string, Cell>; fetched: Map<string, Staged> }) {
  const list = rows
    .map((s) => ({
      name: s.name,
      years: YEARS.filter((y) => !have.has(`${s.id}:${y}`) && !fetched.has(`${s.id}:${y}`)).reverse(),
    }))
    .filter((s) => s.years.length);
  if (!list.length) return null;
  return (
    <section className="game-card p-4" aria-labelledby="gaps-t">
      <h2 id="gaps-t" className="text-lg font-semibold">Years with nothing yet</h2>
      <p className="text-sm text-muted-foreground">These are the only papers worth fetching. Whether MyQuest has a paper for each one is still unchecked.</p>
      <dl className="mt-3 space-y-2 text-sm">
        {list.map((s) => (
          <div key={s.name} className="flex gap-3">
            <dt className="w-44 shrink-0 font-semibold">{s.name}</dt>
            <dd className="text-muted-foreground">{s.years.join(", ")}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Key({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("grid size-6 place-items-center rounded-md text-xs font-semibold", className)} aria-hidden />
      {label}
    </span>
  );
}

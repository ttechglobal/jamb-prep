import Link from "next/link";
import { AdminPage } from "@/components/admin/gate";
import { ago, formatDate, PeriodNav, periodFrom, Stat, Th } from "@/components/admin/period-nav";
import { adminDb } from "@/lib/admin/auth";

interface School {
  id: string;
  name: string;
  state: string;
  area: string;
  phone: string;
  created_at: string;
  last_seen_at: string | null;
  devices: number;
  active_devices: number;
  sessions_started: number;
  sessions_completed: number;
  questions_answered: number;
  active_days: number;
}

type Params = Promise<{ days?: string; q?: string }>;

export default function AdminSchoolsPage({ searchParams }: { searchParams: Params }) {
  return (
    <AdminPage>
      <SchoolsData searchParams={searchParams} />
    </AdminPage>
  );
}

async function SchoolsData({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const days = periodFrom(sp.days);
  const q = (sp.q ?? "").trim().toLowerCase().slice(0, 60);
  const { data, error } = await adminDb().rpc("admin_schools", { p_days: days });
  if (error || !data) return <p role="alert">Couldn&apos;t load the schools. Refresh to try again.</p>;
  const all = (data as { schools: School[] }).schools;
  const shown = all.filter((s) => !q || `${s.name} ${s.state} ${s.area}`.toLowerCase().includes(q));

  const active = all.filter((s) => s.sessions_started > 0).length;
  const devices = all.reduce((n, s) => n + s.devices, 0);
  const rounds = all.reduce((n, s) => n + s.sessions_completed, 0);
  const questions = all.reduce((n, s) => n + s.questions_answered, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold">Schools</h1>
        <PeriodNav href={`/admin/schools${q ? `?q=${encodeURIComponent(q)}` : ""}`} days={days} />
      </div>

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Schools" value={all.length} note={`${active} used the app in the last ${days} days`} />
        <Stat label="Computers" value={devices} note="registered in all" />
        <Stat label="Rounds finished" value={rounds} note={`last ${days} days`} />
        <Stat label="Questions answered" value={questions} note={`last ${days} days`} />
      </section>

      <form className="flex gap-2" role="search">
        <input type="hidden" name="days" value={days} />
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search by school, state or area</span>
          <input name="q" defaultValue={q} placeholder="Search school, state or area" className="h-11 w-full rounded-xl border-2 bg-background px-3" />
        </label>
      </form>

      <section className="game-card overflow-x-auto">
        {shown.length ? (
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                <Th>School</Th>
                <Th>Registered</Th>
                <Th>Last seen</Th>
                <Th right>Computers</Th>
                <Th right>Active days</Th>
                <Th right>Rounds</Th>
                <Th right>Questions</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shown.map((s) => (
                <tr key={s.id} className="hover:bg-muted/50">
                  <td className="px-3 py-2">
                    <Link href={`/admin/schools/${s.id}?days=${days}`} className="font-semibold text-primary underline-offset-2 hover:underline">
                      {s.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {s.area}, {s.state} · {s.phone}
                    </p>
                  </td>
                  <td className="px-3 py-2">{formatDate(s.created_at)}</td>
                  <td className="px-3 py-2">{ago(s.last_seen_at)}</td>
                  <td className="px-3 py-2 text-right">
                    {s.active_devices} of {s.devices}
                  </td>
                  <td className="px-3 py-2 text-right">{s.active_days}</td>
                  <td className="px-3 py-2 text-right font-semibold">{s.sessions_completed}</td>
                  <td className="px-3 py-2 text-right">{s.questions_answered}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-4 text-muted-foreground">{all.length ? "No school matches that search." : "No school has registered the app yet."}</p>
        )}
      </section>
    </div>
  );
}

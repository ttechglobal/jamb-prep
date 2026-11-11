import { Search } from "lucide-react";
import Link from "next/link";
import { AdminPage } from "@/components/admin/gate";
import { ago, formatDate, PeriodNav, periodFrom, Stat, Th } from "@/components/admin/period-nav";
import { adminDb } from "@/lib/admin/auth";

interface UserRow {
  id: string;
  name: string | null;
  email: string | null;
  joined: string;
  last_active: string | null;
  xp: number;
  streak: number;
  sessions: number;
  questions: number;
  rounds_in_period: number;
  reminders: boolean;
}
interface Users {
  days: number;
  total: number;
  joined_in_period: number;
  active_in_period: number;
  users: UserRow[];
}

type Params = Promise<{ days?: string; q?: string; sort?: string }>;
const SORTS = { recent: "Last active", rounds: "Most rounds", newest: "Newest", xp: "Most XP" } as const;

export default function AdminUsersPage({ searchParams }: { searchParams: Params }) {
  return (
    <AdminPage>
      <UsersData searchParams={searchParams} />
    </AdminPage>
  );
}

async function UsersData({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const days = periodFrom(sp.days);
  const q = (sp.q ?? "").trim().toLowerCase().slice(0, 60);
  const sort = (sp.sort && sp.sort in SORTS ? sp.sort : "recent") as keyof typeof SORTS;

  const { data, error } = await adminDb().rpc("admin_users", { p_days: days });
  if (error || !data) return <p role="alert">Couldn&apos;t load the users. Refresh to try again.</p>;
  const o = data as Users;

  const shown = o.users
    .filter((u) => !q || `${u.name ?? ""} ${u.email ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) => {
      if (sort === "rounds") return b.rounds_in_period - a.rounds_in_period;
      if (sort === "newest") return +new Date(b.joined) - +new Date(a.joined);
      if (sort === "xp") return b.xp - a.xp;
      return +new Date(b.last_active ?? 0) - +new Date(a.last_active ?? 0);
    });
  const keep = `days=${days}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold">Users</h1>
        <PeriodNav href={`/admin/users?sort=${sort}${q ? `&q=${encodeURIComponent(q)}` : ""}`} days={days} />
      </div>

      <section aria-label="Key numbers" className="grid grid-cols-3 gap-3">
        <Stat label="Members" value={o.total} note="signed up and set up" />
        <Stat label="New" value={o.joined_in_period} note={`last ${days} days`} />
        <Stat label="Practised" value={o.active_in_period} note={`last ${days} days`} />
      </section>

      <form className="flex flex-wrap items-center gap-2" role="search">
        <input type="hidden" name="days" value={days} />
        <input type="hidden" name="sort" value={sort} />
        <label className="relative min-w-0 flex-1 basis-60">
          <span className="sr-only">Search by name or email</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input name="q" defaultValue={q} placeholder="Search name or email" className="h-11 w-full rounded-xl border-2 bg-background pl-9 pr-3" />
        </label>
        <nav aria-label="Sort" className="flex rounded-xl bg-muted p-1">
          {Object.entries(SORTS).map(([k, label]) => (
            <Link
              key={k}
              href={`/admin/users?${keep}&sort=${k}`}
              aria-current={k === sort ? "page" : undefined}
              className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-muted-foreground aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-sm"
            >
              {label}
            </Link>
          ))}
        </nav>
      </form>

      <section className="game-card overflow-x-auto">
        {shown.length ? (
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                <Th>Student</Th>
                <Th>Joined</Th>
                <Th>Last active</Th>
                <Th right>Rounds ({days}d)</Th>
                <Th right>Questions</Th>
                <Th right>XP</Th>
                <Th right>Streak</Th>
                <Th>Reminders</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shown.map((u) => (
                <tr key={u.id} className="hover:bg-muted/50">
                  <td className="px-3 py-2">
                    <Link href={`/admin/users/${u.id}?days=${days}`} className="font-semibold text-primary underline-offset-2 hover:underline">
                      {u.name ?? "No name"}
                    </Link>
                    <p className="text-xs text-muted-foreground">{u.email ?? "No email"}</p>
                  </td>
                  <td className="px-3 py-2">{formatDate(u.joined)}</td>
                  <td className="px-3 py-2">{ago(u.last_active)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{u.rounds_in_period}</td>
                  <td className="px-3 py-2 text-right">{u.questions}</td>
                  <td className="px-3 py-2 text-right">{u.xp}</td>
                  <td className="px-3 py-2 text-right">{u.streak}</td>
                  <td className="px-3 py-2">{u.reminders ? "On" : "Off"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-4 text-muted-foreground">{o.users.length ? "Nobody matches that search." : "Nobody has signed up yet."}</p>
        )}
      </section>
      {o.total > o.users.length ? (
        <p className="text-sm text-muted-foreground">
          Showing the {o.users.length} most recent of {o.total} members.
        </p>
      ) : null}
    </div>
  );
}

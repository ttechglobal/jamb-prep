import Link from "next/link";

export const PERIODS = [7, 30, 90, 365];

/** Picks how many days back the numbers on a page look. */
export function PeriodNav({ href, days }: { href: string; days: number }) {
  return (
    <nav aria-label="Period" className="ml-auto flex rounded-xl bg-muted p-1">
      {PERIODS.map((p) => (
        <Link
          key={p}
          href={`${href}${href.includes("?") ? "&" : "?"}days=${p}`}
          aria-current={p === days ? "page" : undefined}
          className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-muted-foreground aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-sm"
        >
          {p === 365 ? "1y" : `${p}d`}
        </Link>
      ))}
    </nav>
  );
}

export const periodFrom = (raw: string | undefined) => (PERIODS.includes(Number(raw)) ? Number(raw) : 30);

const date = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
const daysAgo = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

export const formatDate = (iso: string | null | undefined) => (iso ? date.format(new Date(iso)) : "never");

/** "today", "3 days ago", or a date once it is old. */
export function ago(iso: string | null | undefined): string {
  if (!iso) return "never";
  const d = daysAgo(iso);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  return d < 30 ? `${d} days ago` : formatDate(iso);
}

export function Stat({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="game-card p-3">
      <p className="text-sm font-semibold leading-tight text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold leading-none">{value}</p>
      {note ? <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{note}</p> : null}
    </div>
  );
}

export function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th scope="col" className={`px-3 py-2 font-semibold ${right ? "text-right" : ""}`}>
      {children}
    </th>
  );
}

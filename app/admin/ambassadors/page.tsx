import { recordPayment } from "@/app/admin/actions";
import { AdminPage } from "@/components/admin/gate";
import { formatDate, Stat } from "@/components/admin/period-nav";
import { adminDb } from "@/lib/admin/auth";
import { accountLabel } from "@/lib/auth/phone";

interface Person {
  id: string;
  name: string | null;
  email: string | null;
  joined: string;
  paid_kobo: number;
}
interface AmbassadorRow {
  id: string;
  name: string;
  email: string;
  code: string;
  created_at: string;
  signups: number;
  paid: number;
  earned_kobo: number;
  people: Person[];
}

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

export default function AdminAmbassadorsPage() {
  return (
    <AdminPage>
      <Data />
    </AdminPage>
  );
}

async function Data() {
  const { data, error } = await adminDb().rpc("admin_ambassadors");
  if (error || !data) return <p role="alert">Couldn&apos;t load the ambassadors. Refresh to try again.</p>;
  const rows = data as AmbassadorRow[];
  const signups = rows.reduce((n, r) => n + r.signups, 0);
  const paid = rows.reduce((n, r) => n + r.paid, 0);
  const owed = rows.reduce((n, r) => n + r.earned_kobo, 0);

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-semibold">Ambassadors</h1>
      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Ambassadors" value={rows.length} />
        <Stat label="Referred sign-ups" value={signups} />
        <Stat label="Of them paid" value={paid} />
        <Stat label="Commission owed" value={naira(owed)} note="20% of what referred students paid" />
      </section>

      {rows.length ? (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="game-card p-4">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-display text-lg font-semibold">{r.name}</span>
                  <span className="text-sm text-muted-foreground">{r.email}</span>
                  <span className="rounded-lg bg-muted px-2 py-0.5 font-mono text-sm font-semibold">{r.code}</span>
                  <span className="ml-auto text-sm">
                    <b>{r.signups}</b> signed up · <b>{r.paid}</b> paid · <b>{naira(r.earned_kobo)}</b> owed
                  </span>
                </summary>
                <p className="mt-2 text-xs text-muted-foreground">Joined as an ambassador {formatDate(r.created_at)}</p>
                {r.people.length ? (
                  <ul className="mt-3 divide-y">
                    {r.people.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
                        <span className="font-medium">{p.name ?? "No name yet"}</span>
                        <span className="text-muted-foreground">{p.email ? accountLabel(p.email) : ""}</span>
                        <span className="text-muted-foreground">{formatDate(p.joined)}</span>
                        <span className="ml-auto flex items-center gap-2">
                          {p.paid_kobo > 0 ? <b className="text-success">Paid {naira(p.paid_kobo)}</b> : <span className="text-muted-foreground">Not paid</span>}
                          <form action={recordPayment} className="flex items-center gap-1.5">
                            <input type="hidden" name="user" value={p.id} />
                            <input name="naira" type="number" min={1} step="any" defaultValue={1000} aria-label="Amount in naira" className="h-9 w-24 rounded-lg border-2 px-2 text-sm" />
                            <button type="submit" className="h-9 rounded-lg border-2 px-3 text-sm font-semibold hover:bg-muted">Record payment</button>
                          </form>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">No sign-ups yet.</p>
                )}
              </details>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">No ambassadors yet. They sign up at /ambassador/signup.</p>
      )}
    </div>
  );
}

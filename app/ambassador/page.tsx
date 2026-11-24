import { LogOut } from "lucide-react";
import { Suspense } from "react";
import { ambassadorLogout } from "@/app/ambassador/actions";
import { AmbassadorLoginForm, ShareCard } from "@/components/ambassador/forms";
import { adminDb } from "@/lib/admin/auth";
import { currentAmbassador } from "@/lib/ambassador/auth";

interface Stats {
  signups: number;
  paid: number;
  earned_kobo: number;
  commission_percent: number;
  people: { name: string; joined: string; paid: boolean }[];
}

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

export default function AmbassadorPage() {
  return (
    <Suspense fallback={<p className="py-10 text-center text-muted-foreground">Loading…</p>}>
      <Gate />
    </Suspense>
  );
}

async function Gate() {
  const me = await currentAmbassador();
  if (!me) return <div className="mx-auto mt-6 max-w-sm"><AmbassadorLoginForm /></div>;

  const { data } = await adminDb().rpc("ambassador_stats", { p_id: me.id });
  if (!data) return <p role="alert">Couldn&apos;t load your numbers. Refresh to try again.</p>;
  const stats = data as Stats;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Hi {me.name.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">Every student who signs up with your link or code is counted as yours.</p>
        </div>
        <form action={ambassadorLogout}>
          <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-xl px-3 font-display font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
            <LogOut className="size-5" aria-hidden />
            Sign out
          </button>
        </form>
      </div>

      <ShareCard code={me.code} />

      <section aria-label="Your numbers" className="grid grid-cols-3 gap-3">
        <Figure label="Signed up" value={stats.signups} note="through your link" />
        <Figure label="Paid" value={stats.paid} note="of those who signed up" />
        <Figure label="You earned" value={naira(stats.earned_kobo)} note={`${stats.commission_percent}% of what they paid`} />
      </section>

      <section aria-labelledby="people" className="game-card p-5">
        <h2 id="people" className="text-lg font-semibold">Your students</h2>
        {stats.people.length ? (
          <ul className="mt-2 divide-y">
            {stats.people.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground">Joined {day(p.joined)}</span>
                <span className={p.paid ? "rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success" : "rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground"}>
                  {p.paid ? "Paid" : "Not paid yet"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No one yet. Share your link and the students who create an account will show up here.</p>
        )}
      </section>
      <p className="text-xs text-muted-foreground">Payments are not switched on yet, so earnings start counting from the day students begin to pay.</p>
    </div>
  );
}

function Figure({ label, value, note }: { label: string; value: number | string; note: string }) {
  return (
    <div className="game-card p-3">
      <p className="text-sm font-semibold leading-tight text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold leading-none">{value}</p>
      <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{note}</p>
    </div>
  );
}

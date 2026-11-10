"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dryRunAction, fetchPaperAction, loadCatalogue, paperStatus } from "./actions";
import { REASON_LABEL, type DryRunResult, type FetchResult, type Option, type PaperStatus } from "./types";

const selectClass = "h-12 w-full rounded-xl border-2 bg-card px-3 text-base disabled:opacity-50";

export function ImportFlow({ exams, loadError, mapped }: { exams: Option[]; loadError: string | null; mapped: string[] }) {
  const [exam, setExam] = useState(exams.find((e) => e.value === "JAMB")?.value ?? "");
  const [years, setYears] = useState<Option[]>([]);
  const [year, setYear] = useState("");
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [subject, setSubject] = useState("");
  const [status, setStatus] = useState<PaperStatus | null>(null);
  const [anyway, setAnyway] = useState(false);
  const [fetched, setFetched] = useState<FetchResult | null>(null);
  const [dry, setDry] = useState<DryRunResult | null>(null);
  const [error, setError] = useState<string | null>(loadError);
  const [busy, start] = useTransition();
  const [step, setStep] = useState<"idle" | "years" | "subjects" | "status" | "fetch" | "dry">("idle");

  const reset = (from: "exam" | "year" | "subject") => {
    if (from === "exam") {
      setYears([]);
      setYear("");
    }
    if (from !== "subject") {
      setSubjects([]);
      setSubject("");
    }
    setStatus(null);
    setFetched(null);
    setDry(null);
    setAnyway(false);
    setError(null);
  };

  const run = (name: typeof step, job: () => Promise<void>) => {
    setStep(name);
    start(async () => {
      await job();
      setStep("idle");
    });
  };

  const pickExam = (value: string) => {
    setExam(value);
    reset("exam");
    if (!value) return;
    run("years", async () => {
      const r = await loadCatalogue("exam_year_id", { exam: value });
      if (r.ok) setYears(r.options);
      else setError(r.error);
    });
  };

  const pickYear = (value: string) => {
    setYear(value);
    reset("year");
    if (!value) return;
    run("subjects", async () => {
      const r = await loadCatalogue("subject", { exam, year: value });
      if (r.ok) setSubjects(r.options);
      else setError(r.error);
    });
  };

  const pickSubject = (value: string) => {
    setSubject(value);
    reset("subject");
    if (!value) return;
    run("status", async () => {
      const r = await paperStatus({ exam, year, subject: value });
      if (r.ok) setStatus(r.status);
      else setError(r.error);
    });
  };

  const fetchIt = () =>
    run("fetch", async () => {
      setError(null);
      setDry(null);
      const r = await fetchPaperAction({ exam, year, subject });
      if (!r.ok) return setError(r.error);
      setFetched(r.result);
      const s = await paperStatus({ exam, year, subject });
      if (s.ok) setStatus(s.status);
      if (r.result.complete) {
        const d = await dryRunAction({ exam, year, subject });
        if (d.ok) setDry(d.result);
        else setError(d.error);
      }
    });

  const checkIt = () =>
    run("dry", async () => {
      setError(null);
      const d = await dryRunAction({ exam, year, subject });
      if (d.ok) setDry(d.result);
      else setError(d.error);
    });

  const inBank = (status?.inBank ?? 0) > 0;
  const alreadyStored = status?.staged?.status === "complete";
  const canFetch = !!status && status.subjectId !== null && (!inBank || anyway) && !busy;

  return (
    <div className="space-y-5">
      {/* 1. Pick */}
      <section className="game-card space-y-4 p-4" aria-labelledby="pick-t">
        <h2 id="pick-t" className="text-lg font-semibold">1. Pick a paper</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Exam">
            <select className={selectClass} value={exam} onChange={(e) => pickExam(e.target.value)} disabled={busy}>
              <option value="">Choose</option>
              {exams.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Year">
            <select className={selectClass} value={year} onChange={(e) => pickYear(e.target.value)} disabled={busy || !years.length}>
              <option value="">{step === "years" ? "Loading…" : "Choose"}</option>
              {years.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Subject">
            <select className={selectClass} value={subject} onChange={(e) => pickSubject(e.target.value)} disabled={busy || !subjects.length}>
              <option value="">{step === "subjects" ? "Loading…" : "Choose"}</option>
              {subjects.map((o) => (
                <option key={o.value} value={o.value} disabled={!mapped.includes(o.value)}>
                  {o.label}{mapped.includes(o.value) ? "" : " (not in our bank)"}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {exam === "" ? <p className="text-sm text-muted-foreground">Years and subjects come straight from MyQuest, so what you see is what they list. Listing them costs nothing.</p> : null}

        {status ? (
          <div className="space-y-3 rounded-xl bg-muted p-3 text-sm" role="status">
            {inBank ? (
              <p className="flex items-start gap-2 font-medium">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-gold-ink" aria-hidden />
                <span>
                  We already hold {status.inBank} {subject} questions for {year}. Fetching again costs money and may add duplicates.
                </span>
              </p>
            ) : (
              <p className="font-medium">Nothing in the bank for {subject} {year}.</p>
            )}
            {status.staged ? (
              <p>
                Already fetched: {status.staged.pages} page{status.staged.pages === 1 ? "" : "s"}, {status.staged.fetched} questions ({status.staged.status}). Stored pages are reused, so fetching again only pays for pages that are missing.
              </p>
            ) : null}
            {inBank ? (
              <label className="flex items-center gap-2 font-medium">
                <input type="checkbox" checked={anyway} onChange={(e) => setAnyway(e.target.checked)} className="size-5" />
                Fetch it anyway
              </label>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* 2. Fetch */}
      <section className="game-card space-y-3 p-4" aria-labelledby="fetch-t">
        <h2 id="fetch-t" className="text-lg font-semibold">2. Fetch</h2>
        <p className="text-sm text-muted-foreground">MyQuest charges about ₦10 for each page of 40 questions. Each page is saved as it arrives, so an interrupted fetch picks up where it stopped.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={fetchIt} disabled={!canFetch} size="lg">
            {step === "fetch" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {alreadyStored ? "Fetch again (reuses saved pages)" : "Fetch paper"}
          </Button>
          {alreadyStored && !dry ? (
            <Button onClick={checkIt} disabled={busy} variant="outline" size="lg">
              Check saved paper
            </Button>
          ) : null}
        </div>

        {fetched ? (
          <div className={cn("rounded-xl p-3 text-sm", fetched.complete ? "bg-primary/10" : "bg-gold-soft text-gold-ink")} role="status">
            <p className="flex items-center gap-2 font-semibold">
              {fetched.complete ? <CheckCircle2 className="size-4" aria-hidden /> : <AlertTriangle className="size-4" aria-hidden />}
              {fetched.complete ? `Adds up: ${fetched.rows} questions over ${fetched.pages} page${fetched.pages === 1 ? "" : "s"}.` : "This paper does not add up, so it can't go any further."}
            </p>
            {fetched.problems.length ? (
              <ul className="mt-1 list-disc pl-5">
                {fetched.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : null}
            {fetched.charged ? <p className="mt-1 text-muted-foreground">Charged {fetched.charged}{fetched.balance ? `. Balance now ${fetched.balance}.` : "."}</p> : <p className="mt-1 text-muted-foreground">No new pages were needed, so nothing was charged.</p>}
          </div>
        ) : null}
      </section>

      {error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      {/* 3. Dry run */}
      {dry ? <DryRun dry={dry} /> : (
        <section className="game-card p-4">
          <h2 className="text-lg font-semibold">3. Dry run</h2>
          <p className="text-sm text-muted-foreground">Shows what would be imported, what would be held back and why. It changes nothing. It appears here once a paper adds up.</p>
        </section>
      )}
    </div>
  );
}

function DryRun({ dry }: { dry: DryRunResult }) {
  const { report, rows } = dry;
  const [show, setShow] = useState<"held" | "rejected" | "ready">("held");
  const list = rows.filter((r) => r.status === show);
  const reasons = Object.entries(report.byReason).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...Object.values(report.keyCounts));

  return (
    <section className="game-card space-y-4 p-4" aria-labelledby="dry-t">
      <div>
        <h2 id="dry-t" className="text-lg font-semibold">3. Dry run</h2>
        <p className="text-sm text-muted-foreground">Nothing has been added to the question bank. This is what would happen.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Tally label="Ready" value={report.ready} tone="ok" />
        <Tally label="Held for review" value={report.held} tone="warn" />
        <Tally label="Rejected" value={report.rejected} tone="bad" />
      </div>

      <div>
        <h3 className="font-semibold">Answer key spread</h3>
        <div className="mt-2 grid grid-cols-4 gap-3">
          {(["A", "B", "C", "D"] as const).map((k) => (
            <div key={k} className="text-center text-sm">
              <div className="flex h-16 items-end justify-center">
                <div className="w-8 rounded-t-md bg-primary" style={{ height: `${Math.max(4, (report.keyCounts[k] / max) * 100)}%` }} />
              </div>
              <p className="mt-1 font-semibold">{k} · {report.keyCounts[k]}</p>
            </div>
          ))}
        </div>
        {report.keySkew ? (
          <p className="mt-2 flex items-start gap-2 rounded-xl bg-gold-soft p-3 text-sm font-medium text-gold-ink" role="alert">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            The keys are lopsided. A real paper spreads its answers fairly evenly, so this one may be generated or mis-keyed. Check a sample against the source before publishing it.
          </p>
        ) : null}
      </div>

      {reasons.length ? (
        <div>
          <h3 className="font-semibold">Why questions are held or rejected</h3>
          <ul className="mt-1 divide-y text-sm">
            {reasons.map(([code, n]) => (
              <li key={code} className="flex gap-3 py-1.5">
                <span>{REASON_LABEL[code] ?? code}</span>
                <span className="ml-auto font-semibold tabular-nums">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <div className="flex rounded-xl bg-muted p-1" role="tablist" aria-label="Questions">
          {(["held", "rejected", "ready"] as const).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={show === s}
              onClick={() => setShow(s)}
              className="inline-flex h-9 flex-1 items-center justify-center rounded-lg text-sm font-semibold capitalize text-muted-foreground aria-selected:bg-card aria-selected:text-foreground aria-selected:shadow-sm"
            >
              {s} ({report[s]})
            </button>
          ))}
        </div>
        {list.length ? (
          <ul className="mt-2 divide-y text-sm">
            {list.map((r) => (
              <li key={String(r.providerId)} className="py-2">
                <p className="font-medium">
                  <span className="mr-2 text-muted-foreground">#{r.providerId}</span>
                  {r.stem}
                  {r.stem.length >= 140 ? "…" : ""}
                </p>
                {r.reasons.length ? <p className="text-muted-foreground">{r.reasons.map((x) => REASON_LABEL[x] ?? x).join(" · ")}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">None.</p>
        )}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

function Tally({ label, value, tone }: { label: string; value: number; tone: "ok" | "warn" | "bad" }) {
  return (
    <div className={cn("rounded-2xl p-3", tone === "ok" && "bg-primary/10", tone === "warn" && "bg-gold-soft text-gold-ink", tone === "bad" && "bg-destructive/10 text-destructive")}>
      <p className="text-sm font-semibold">{label}</p>
      <p className="font-display text-3xl font-semibold leading-none">{value}</p>
    </div>
  );
}

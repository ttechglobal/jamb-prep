"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { YearRow } from "@/lib/myquest/gaps";
import { Batches } from "./batches";
import { dryRunAction, fetchPaperAction, paperStatus, yearsForSubject } from "./actions";
import { REASON_LABEL, type DryRunResult, type FetchResult, type PaperStatus } from "./types";

const selectClass = "h-12 w-full rounded-xl border-2 bg-card px-3 text-base disabled:opacity-50";

const EXAM = "JAMB";

export function ImportFlow({ subjects }: { subjects: { id: string; name: string }[] }) {
  const [subjectId, setSubjectId] = useState("");
  const [provider, setProvider] = useState("");
  const [rows, setRows] = useState<YearRow[]>([]);
  const [showHeld, setShowHeld] = useState(false);
  const [year, setYear] = useState("");
  const [status, setStatus] = useState<PaperStatus | null>(null);
  const [anyway, setAnyway] = useState(false);
  const [fetched, setFetched] = useState<FetchResult | null>(null);
  const [dry, setDry] = useState<DryRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [step, setStep] = useState<"idle" | "years" | "status" | "fetch" | "dry">("idle");

  const subjectName = subjects.find((x) => x.id === subjectId)?.name ?? "";

  const clearPaper = () => {
    setYear("");
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

  const pickSubject = (id: string) => {
    setSubjectId(id);
    setRows([]);
    setProvider("");
    clearPaper();
    if (!id) return;
    run("years", async () => {
      const r = await yearsForSubject(id);
      if (r.ok) {
        setRows(r.rows);
        setProvider(r.provider);
      } else setError(r.error);
    });
  };

  const pickYear = (value: string) => {
    clearPaper();
    setYear(value);
    run("status", async () => {
      const r = await paperStatus({ exam: EXAM, year: value, subject: provider });
      if (r.ok) setStatus(r.status);
      else setError(r.error);
    });
  };

  const paper = { exam: EXAM, year, subject: provider };

  const fetchIt = () =>
    run("fetch", async () => {
      setError(null);
      setDry(null);
      const r = await fetchPaperAction(paper);
      if (!r.ok) return setError(r.error);
      setFetched(r.result);
      const s = await paperStatus(paper);
      if (s.ok) setStatus(s.status);
      if (r.result.complete) {
        const d = await dryRunAction(paper);
        if (d.ok) setDry(d.result);
        else setError(d.error);
      }
    });

  const checkIt = () =>
    run("dry", async () => {
      setError(null);
      const d = await dryRunAction(paper);
      if (d.ok) setDry(d.result);
      else setError(d.error);
    });

  const gaps = rows.filter((r) => r.state === "gap");
  const staged = rows.filter((r) => r.state === "staged");
  const held = rows.filter((r) => r.state === "held");
  const shown = showHeld ? rows : rows.filter((r) => r.state !== "held");

  const inBank = (status?.inBank ?? 0) > 0;
  const notListed = status?.listed === false;
  const alreadyStored = status?.staged?.status === "complete";
  const canFetch = !!status && status.subjectId !== null && !notListed && (!inBank || anyway) && !busy;

  return (
    <div className="space-y-5">
      {/* 1. Pick */}
      <section className="game-card space-y-4 p-4" aria-labelledby="pick-t">
        <h2 id="pick-t" className="text-lg font-semibold">1. Pick a subject and year</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Exam">
            <div className={`${selectClass} flex items-center font-semibold`}>{EXAM}</div>
          </Field>
          <Field label="Subject">
            <select className={selectClass} value={subjectId} onChange={(e) => pickSubject(e.target.value)} disabled={busy}>
              <option value="">Choose a subject</option>
              {subjects.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </Field>
        </div>

        {step === "years" ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Loading the years…
          </p>
        ) : null}

        {rows.length ? (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-semibold">{subjectName}:</span> {gaps.length} year{gaps.length === 1 ? "" : "s"} with no questions
              {staged.length ? `, ${staged.length} fetched but not in the bank` : ""}
              {held.length ? `, ${held.length} already in the bank` : ""}.
            </p>

            {shown.length ? (
              <ul className="flex flex-wrap gap-2" aria-label="Years">
                {shown.map((r) => (
                  <li key={r.year}>
                    <button
                      type="button"
                      onClick={() => pickYear(r.year)}
                      disabled={busy}
                      aria-pressed={year === r.year}
                      title={
                        r.state === "held"
                          ? `${r.inBank} questions already in the bank`
                          : r.state === "staged"
                            ? `${r.staged?.fetched ?? 0} fetched, not in the bank yet`
                            : "No questions yet"
                      }
                      className={cn(
                        "inline-flex h-11 min-w-16 items-center justify-center gap-1.5 rounded-xl border-2 px-3 font-semibold tabular-nums",
                        r.state === "gap" && "bg-card hover:bg-muted",
                        r.state === "staged" && "border-gold/60 bg-gold-soft text-gold-ink",
                        r.state === "held" && "bg-muted text-muted-foreground",
                        year === r.year && "border-primary ring-2 ring-primary/30",
                      )}
                    >
                      {r.year}
                      {r.state === "held" ? <span className="text-xs font-medium">{r.inBank}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Every year MyQuest lists is already in the bank.</p>
            )}

            {held.length ? (
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={showHeld} onChange={(e) => setShowHeld(e.target.checked)} className="size-5" />
                Also show years we already hold (the number is how many questions)
              </label>
            ) : null}
            <p className="text-xs text-muted-foreground">Gaps are listed from MyQuest&apos;s own years. Whether it has a paper for this subject in a given year is checked when you pick it.</p>
          </div>
        ) : null}

        {status ? (
          <div className="space-y-3 rounded-xl bg-muted p-3 text-sm" role="status">
            {notListed ? (
              <p className="flex items-start gap-2 font-medium text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>MyQuest has no {subjectName} paper for {year}. Pick another year.</span>
              </p>
            ) : inBank ? (
              <p className="flex items-start gap-2 font-medium">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-gold-ink" aria-hidden />
                <span>
                  We already hold {status.inBank} {subjectName} questions for {year}. Fetching again costs money and may add duplicates.
                </span>
              </p>
            ) : (
              <p className="font-medium">Nothing in the bank for {subjectName} {year}.</p>
            )}
            {status.staged ? (
              <p>
                Already fetched: {status.staged.pages} page{status.staged.pages === 1 ? "" : "s"}, {status.staged.fetched} questions ({status.staged.status}). Stored pages are reused, so fetching again only pays for pages that are missing.
              </p>
            ) : null}
            {inBank && !notListed ? (
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

      {dry ? <Batches key={`${paper.subject}-${paper.year}`} paper={paper} /> : null}
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

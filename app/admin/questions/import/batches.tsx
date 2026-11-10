"use client";

import { AlertTriangle, Check, CheckCircle2, ClipboardCopy, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { Blocks } from "@/components/content/blocks";
import { SolutionView } from "@/components/content/solution-view";
import { Button } from "@/components/ui/button";
import { FLAG_LABEL } from "@/lib/myquest/enrich/labels";
import { cn } from "@/lib/utils";
import { checkReplyAction, loadBatches, type BatchView, type ReplyResult } from "./enrich-actions";
import type { PaperInput } from "./types";

/** Step 4: copy a prompt, paste it into an AI chat, paste the reply back, review what the app flags. */
export function Batches({ paper }: { paper: PaperInput }) {
  const [batches, setBatches] = useState<BatchView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadBatches(paper).then((r) => {
      if (!live) return;
      if (r.ok) setBatches(r.batches);
      else setError(r.error);
    });
    return () => {
      live = false;
    };
  }, [paper.exam, paper.year, paper.subject]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="game-card space-y-4 p-4" aria-labelledby="enrich-t">
      <div>
        <h2 id="enrich-t" className="text-lg font-semibold">4. AI explanations</h2>
        <p className="text-sm text-muted-foreground">
          For each batch: copy the prompt into an AI chat, paste its JSON reply here, and check what the app flags. Nothing is saved to the question bank from this page yet.
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">{error}</p>
      ) : !batches ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Building the prompts…
        </p>
      ) : (
        <div className="space-y-4">
          {batches.map((b) => (
            <BatchCard key={b.no} paper={paper} batch={b} total={batches.length} />
          ))}
        </div>
      )}
    </section>
  );
}

function BatchCard({ paper, batch, total }: { paper: PaperInput; batch: BatchView; total: number }) {
  const [reply, setReply] = useState(batch.saved?.reply ?? "");
  const [model, setModel] = useState(batch.saved?.model ?? "");
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<ReplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(batch.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Couldn't copy. Select the prompt text below and copy it by hand.");
    }
  };

  const check = () =>
    start(async () => {
      setError(null);
      const r = await checkReplyAction(paper, batch.no, reply, model);
      if (r.ok) setResult(r.result);
      else setError(r.error);
    });

  const ok = result?.questions.filter((q) => q.publishable).length ?? 0;

  return (
    <article className="rounded-2xl border-2 p-4" aria-label={`Batch ${batch.no}`}>
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-semibold">
          Batch {batch.no} of {total}
          <span className="ml-2 font-normal text-muted-foreground">{batch.count} questions</span>
        </h3>
        <Button onClick={copy} size="sm" variant="outline" className="ml-auto">
          {copied ? <Check className="size-4" aria-hidden /> : <ClipboardCopy className="size-4" aria-hidden />}
          {copied ? "Copied" : "Copy prompt"}
        </Button>
      </div>

      {batch.figures.length ? (
        <div className="mt-3 rounded-xl bg-gold-soft p-3 text-sm text-gold-ink">
          <p className="font-semibold">Attach these diagrams to the chat, in this order:</p>
          <ul className="mt-1 space-y-0.5">
            {batch.figures.map((f) => (
              <li key={f.label}>
                <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium underline underline-offset-2">
                  {f.label} <span className="font-normal">(question {f.providerId})</span> <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs">Open each, save the image, and attach it before sending the prompt.</p>
        </div>
      ) : null}

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground">Show the prompt ({batch.prompt.length.toLocaleString()} characters)</summary>
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-muted p-3 text-xs">{batch.prompt}</pre>
      </details>

      <div className="mt-4 space-y-2">
        <label className="block text-sm font-semibold" htmlFor={`reply-${batch.no}`}>
          Paste the AI&apos;s reply
        </label>
        <textarea
          id={`reply-${batch.no}`}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={6}
          spellCheck={false}
          placeholder="Paste the JSON here"
          className="w-full rounded-xl border-2 bg-card p-3 font-mono text-xs"
        />
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="font-semibold">Which AI and model?</span>
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="for example Claude Sonnet" className="mt-1 block h-10 w-64 max-w-full rounded-xl border-2 bg-card px-3 text-sm" />
          </label>
          <Button onClick={check} disabled={busy || !reply.trim()}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Check the reply
          </Button>
        </div>
        {batch.saved && !result ? <p className="text-xs text-muted-foreground">A reply saved on {new Date(batch.saved.savedAt).toLocaleString()} is filled in. Press Check to look at it again.</p> : null}
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</p>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-3">
          {result.error ? (
            <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">{result.error}</p>
          ) : (
            <>
              <p className={cn("flex items-center gap-2 rounded-xl p-3 text-sm font-semibold", ok === result.questions.length ? "bg-primary/10" : "bg-gold-soft text-gold-ink")} role="status">
                {ok === result.questions.length ? <CheckCircle2 className="size-4" aria-hidden /> : <AlertTriangle className="size-4" aria-hidden />}
                {ok} of {result.questions.length} questions have no blocking problems.
              </p>
              {result.warnings.length ? (
                <ul className="list-disc rounded-xl bg-muted p-3 pl-7 text-sm">
                  {result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
              {result.unknownIds.length ? <p className="text-sm text-destructive">The reply has ids that are not in this batch: {result.unknownIds.join(", ")}.</p> : null}
              <ul className="space-y-2">
                {result.questions.map((q) => (
                  <QuestionPreview key={q.id} q={q} />
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}

function QuestionPreview({ q }: { q: ReplyResult["questions"][number] }) {
  const blocking = q.flags.filter((f) => f.severity === "block");
  const warnings = q.flags.filter((f) => f.severity === "warn");
  const shownKey = q.aiKey ?? q.providerKey;

  return (
    <li>
      <details open={blocking.length > 0} className="rounded-xl border-2">
        <summary className="flex cursor-pointer flex-wrap items-center gap-2 p-3">
          <span className="font-semibold">Question {q.position}</span>
          <span className="text-xs text-muted-foreground">MyQuest #{q.providerId}</span>
          <span className={cn("ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold", q.publishable ? "bg-primary/15" : "bg-destructive/15 text-destructive")}>
            {q.publishable ? (warnings.length ? `OK, ${warnings.length} to look at` : "OK") : `${blocking.length} problem${blocking.length === 1 ? "" : "s"}`}
          </span>
        </summary>

        <div className="space-y-3 border-t-2 p-3">
          {q.flags.length ? (
            <ul className="space-y-1 text-sm">
              {q.flags.map((f, i) => (
                <li key={`${f.code}-${i}`} className={cn("flex items-start gap-2 rounded-lg px-2.5 py-1.5", f.severity === "block" ? "bg-destructive/10 text-destructive" : "bg-gold-soft text-gold-ink")}>
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    <span className="font-semibold">{FLAG_LABEL[f.code] ?? f.code}.</span>
                    {f.detail ? <span className="ml-1">{f.detail}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="rounded-xl bg-muted/60 p-3">
            <Blocks blocks={q.stem} />
            {q.figure ? (
              <p className="mt-2 text-sm">
                Diagram {q.figure.label}: {q.figureAlt ? <span>{q.figureAlt}</span> : <span className="text-destructive">no description yet</span>}
              </p>
            ) : null}
            <ol className="mt-3 space-y-1.5">
              {q.options.map((o) => (
                <li key={o.key} className={cn("flex gap-2 rounded-lg px-2 py-1", o.key === shownKey && "bg-primary/10 font-medium")}>
                  <span className="w-5 font-semibold">{o.key}</span>
                  <span className="min-w-0 flex-1">
                    <Blocks blocks={o.blocks} />
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {o.key === q.aiKey ? "AI" : ""}
                    {o.key === q.aiKey && o.key === q.providerKey ? " + " : ""}
                    {o.key === q.providerKey ? "MyQuest" : ""}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {q.topic ? (
            <p className="text-sm">
              <span className="font-semibold">Topic:</span> {q.topic.name}
              {q.subtopic ? ` › ${q.subtopic.name}` : ""}
            </p>
          ) : null}

          {q.solution ? (
            <div className="rounded-xl border-2 border-dashed p-3">
              <p className="text-sm font-semibold">
                The correct answer is {q.aiKey}
                {q.aiKey ? ` — ${q.options.find((o) => o.key === q.aiKey)?.blocks.map((b) => ("content" in b ? b.content.map((c) => ("text" in c ? c.text : c.math)).join("") : "")).join(" ")}` : ""}
              </p>
              <SolutionView solution={q.solution} selected={null} />
              {q.hint.length ? (
                <div className="mt-2 text-sm text-muted-foreground">
                  <span className="font-semibold">Hint:</span> <Blocks blocks={q.hint} className="inline" />
                </div>
              ) : null}
            </div>
          ) : q.aiIssues.length ? (
            <p className="text-sm text-muted-foreground">AI notes: {q.aiIssues.join(" ")}</p>
          ) : null}
        </div>
      </details>
    </li>
  );
}

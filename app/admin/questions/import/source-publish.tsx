"use client";

import { Loader2, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { publishSourceAction, undoPublishAction, type PublishResult } from "./publish-actions";
import type { PaperInput } from "./types";

/** Step 4 for a prescribed book: no AI step and no explanations. The source's answers are used as they are. */
export function SourcePublish({ paper, title, ready, onLive }: { paper: PaperInput; title: string; ready: number; onLive?: (published: number | null) => void }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ result: PublishResult; held: number } | null>(null);

  const publish = () =>
    start(async () => {
      setError(null);
      const r = await publishSourceAction(paper);
      if (!r.ok) return setError(r.error);
      setDone({ result: r.result, held: r.held });
      onLive?.(r.result.published);
    });

  const undo = (id: string) =>
    start(async () => {
      setError(null);
      const r = await undoPublishAction(id);
      if (!r.ok) return setError(r.error);
      setDone(null);
      onLive?.(null);
    });

  return (
    <section className="game-card space-y-3 p-4" aria-labelledby="src-t">
      <div>
        <h2 id="src-t" className="text-lg font-semibold">4. Publish</h2>
        <p className="text-sm text-muted-foreground">
          {title} is a book students read. These questions use MyQuest&apos;s answers as they are, with no AI step and no explanation. They are filed under English and shown to students as coming from the recommended text.
        </p>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      {done?.result.batchId ? (
        <div className="space-y-2">
          <p className="font-semibold" role="status">{done.result.published} questions are now live.</p>
          {done.held ? <p className="text-sm text-muted-foreground">{done.held} were held back by the importer&apos;s checks.</p> : null}
          {done.result.notPublished.length ? <p className="text-sm text-muted-foreground">Skipped: {done.result.notPublished.map((n) => `#${n.position} (${n.reason})`).join(", ")}.</p> : null}
          <Button variant="outline" onClick={() => undo(done.result.batchId!)} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Undo2 aria-hidden />} Undo this publish
          </Button>
        </div>
      ) : (
        <Button onClick={publish} disabled={busy || ready === 0}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : null} Publish {ready} question{ready === 1 ? "" : "s"} to students
        </Button>
      )}
    </section>
  );
}

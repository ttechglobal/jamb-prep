"use client";

import { useState } from "react";
import { AnswerFeedback } from "@/components/session/answer-feedback";
import { QuestionView } from "@/components/session/question-view";
import { Button } from "@/components/ui/button";
import { FIXTURES, INVALID_EXAMPLES, type ContentFixture } from "@/lib/content/fixtures";
import { validateQuestion } from "@/lib/content/validate";
import type { OptionKey } from "@/lib/types";

/** Renderer test bench. Not part of the product. Delete before the pilot. */

function FixtureCard({ fixture, number, total }: { fixture: ContentFixture; number: number; total: number }) {
  const [selected, setSelected] = useState<OptionKey | null>(null);
  const [revealed, setRevealed] = useState(false);

  return (
    <section data-fixture={fixture.id} className="rounded-2xl border-2 bg-card p-4">
      <header className="mb-3 border-b pb-2">
        <p className="text-sm font-semibold">{fixture.title}</p>
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold uppercase">{fixture.source}</span>
          {fixture.note ? ` · ${fixture.note}` : ""}
        </p>
      </header>

      <QuestionView
        question={fixture.question}
        number={number}
        total={total}
        selected={selected}
        reveal={revealed ? fixture.reveal : null}
        onSelect={setSelected}
        still
      />

      {revealed ? (
        <AnswerFeedback reveal={fixture.reveal} selected={selected} className="mt-4" />
      ) : null}

      <div className="mt-4 flex gap-2">
        <Button variant={revealed ? "outline" : "default"} onClick={() => setRevealed(!revealed)}>
          {revealed ? "Back to question" : selected ? "Submit" : "Skip and review"}
        </Button>
      </div>
    </section>
  );
}

export default function ContentPreviewPage() {
  const order = FIXTURES.flatMap((g) => g.items.map((item) => item.id));

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Question renderer test</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Test content only. None of this is in the question bank. Skipping a question shows the unanswered review state.
        </p>
      </header>

      {FIXTURES.map((group) => (
        <div key={group.group} className="space-y-4">
          <h2 className="font-display text-lg font-semibold">{group.group}</h2>
          {group.items.map((fixture) => (
            <FixtureCard key={fixture.id} fixture={fixture} number={order.indexOf(fixture.id) + 1} total={order.length} />
          ))}
        </div>
      ))}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">7. Timed payload</h2>
        <p className="rounded-2xl border-2 bg-card p-4 text-sm leading-relaxed">
          Checked against the real database in <code>npm run db:test</code>: a timed question carries its passage and prescribed work,
          but no answer key, hint or solution figure. Those arrive only after submission.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">8. Rows that must be stopped</h2>
        {INVALID_EXAMPLES.map((example) => {
          const issues = validateQuestion(example.draft);
          const caught = issues.includes(example.expected as (typeof issues)[number]);
          return (
            <div key={example.title} data-invalid={caught ? "caught" : "missed"} className="rounded-2xl border-2 bg-card p-4 text-sm">
              <p className="font-semibold">{example.title}</p>
              <p className="mt-1 text-muted-foreground">
                {caught ? "Stopped" : "NOT STOPPED"}: {issues.join(", ") || "no issues found"}
              </p>
            </div>
          );
        })}
      </section>
    </main>
  );
}

"use client";

import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PartnerRow } from "@/components/partners/partner-row";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/lib/app-state";
import { getPartners, markEventsRead, type PartnerEvent, type Partners } from "@/lib/partners/client";

const EVENT_TEXT: Record<PartnerEvent["kind"], (name: string) => string> = {
  request: (n) => `${n} wants to study with you`,
  joined: (n) => `${n} is now your study partner`,
  nudge: (n) => `${n} nudged you to practise`,
  practised: (n) => `${n} has practised today`,
};

/** Practice home: your study partners at a glance, or a short invitation to add one. */
export function PartnerCard() {
  const { isGuest } = useAppState();
  const [state, setState] = useState<Partners | null>(null);

  const load = useCallback(async () => {
    try {
      setState(await getPartners());
    } catch {
      // Stays hidden: the card is a bonus and must never get in the way of practice.
    }
  }, []);

  useEffect(() => {
    if (isGuest) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [isGuest, load]);

  if (isGuest || !state) return null;

  const hasAny = state.partners.length > 0 || state.incoming.length > 0 || state.outgoing.length > 0;

  if (!hasAny) {
    return (
      <Link href="/partners" className="order-3 game-card game-tap flex items-center gap-3 p-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-soft text-sky">
          <Users className="size-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[1.05rem] font-semibold leading-tight">Study with a friend</span>
          <span className="block text-xs text-muted-foreground">See each other&apos;s streaks and nudge each other to practise.</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    );
  }

  return (
    <section aria-labelledby="partners-title" className="order-3 game-card p-4">
      <div className="flex items-center gap-2">
        <Users className="size-5 text-primary" aria-hidden />
        <h2 id="partners-title" className="flex-1 font-display text-lg font-semibold">
          Study partners
        </h2>
        <Link href="/partners" className="-m-2 inline-flex min-h-11 items-center p-2 text-sm font-semibold text-primary hover:underline">
          Manage
        </Link>
      </div>

      {state.events.length > 0 ? (
        <div className="mt-3 rounded-xl bg-muted p-3 text-sm" role="status">
          <ul className="space-y-1">
            {state.events.slice(0, 3).map((e) => (
              <li key={e.id}>{EVENT_TEXT[e.kind](e.name)}</li>
            ))}
          </ul>
          <Button
            variant="ghost"
            size="lg"
            className="-mb-1 mt-1 px-2"
            onClick={async () => {
              await markEventsRead();
              void load();
            }}
          >
            Got it
          </Button>
        </div>
      ) : null}

      {state.incoming.length > 0 ? (
        <Link href="/partners" className="mt-3 flex min-h-11 items-center justify-between rounded-xl bg-gold-soft px-3 text-sm font-semibold text-gold-ink">
          {state.incoming.length === 1 ? `${state.incoming[0].name} asked to study with you` : `${state.incoming.length} study requests`}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : null}

      {state.partners.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {state.partners.map((p) => (
            <PartnerRow key={p.id} partner={p} onChanged={load} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

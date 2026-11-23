"use client";

import { Check, Flame, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { commitmentLabel, partnerAction, type Partner } from "@/lib/partners/client";
import { cn } from "@/lib/utils";

const STATUS: Record<Partner["today"], string> = {
  done: "Practised today",
  started: "Started today",
  not_yet: "Hasn't practised yet",
};

/** One study partner: their streak, how today is going, and a nudge when they haven't finished. */
export function PartnerRow({ partner, onChanged, trailing }: { partner: Partner; onChanged: () => void; trailing?: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [nudged, setNudged] = useState(partner.nudgedByMe);
  const commitment = commitmentLabel(partner.commitment);
  const canNudge = partner.today !== "done";
  // From the second day away, the plain "hasn't practised yet" gives way to how long it has been.
  const away = partner.today !== "done" && partner.daysAway !== null && partner.daysAway >= 2 ? partner.daysAway : null;

  async function nudge() {
    setBusy(true);
    try {
      await partnerAction({ action: "nudge", id: partner.id });
      setNudged(true);
      void track("partner_nudge_sent");
      toast.success(`Nudged ${partner.name}`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center gap-3 rounded-xl border-2 p-2.5">
      <span
        aria-hidden
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full font-display text-base font-semibold",
          partner.today === "done" ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
        )}
      >
        {partner.today === "done" ? <Check className="size-5" strokeWidth={3} /> : partner.name.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold leading-tight">
          <span className="truncate">{partner.name}</span>
          <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-flame" aria-label={`${partner.streak} day streak`}>
            <Flame className="size-3.5" aria-hidden />
            {partner.streak}
          </span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {away ? <span className="font-semibold text-destructive">Hasn&apos;t practised in {away} days</span> : STATUS[partner.today]}
          {commitment ? ` · Promised ${commitment.toLowerCase()}` : ""}
        </p>
      </div>
      {canNudge ? (
        <Button variant="outline" size="lg" disabled={busy || nudged} onClick={nudge} aria-label={`Nudge ${partner.name}`}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : nudged ? "Nudged" : "Nudge"}
        </Button>
      ) : null}
      {trailing}
    </li>
  );
}

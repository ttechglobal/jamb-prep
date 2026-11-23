"use client";

import Link from "next/link";
import { ArrowLeft, Check, Copy, Loader2, MessageCircle, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PartnerRow } from "@/components/partners/partner-row";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { track } from "@/lib/analytics";
import {
  COMMITMENT_PRESETS,
  getPartners,
  inviteLink,
  markEventsRead,
  myPartnerCode,
  partnerAction,
  removePartner,
  setCommitment,
  whatsappInvite,
  type Commitment,
  type Partners,
} from "@/lib/partners/client";
import { cn } from "@/lib/utils";

export default function PartnersPage() {
  const [state, setState] = useState<Partners | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [entered, setEntered] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await getPartners());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    myPartnerCode().then(setCode).catch(() => {});
    void markEventsRead();
  }, [load]);

  async function sendRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!entered.trim()) return;
    setSending(true);
    try {
      const { status } = await partnerAction({ action: "request", code: entered.trim() });
      void track(status === "active" ? "partner_accepted" : "partner_request_sent");
      toast.success(status === "active" ? "You're now study partners" : "Request sent");
      setEntered("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send that.");
    } finally {
      setSending(false);
    }
  }

  async function respond(id: string, accept: boolean) {
    try {
      await partnerAction({ action: "respond", id, accept });
      if (accept) void track("partner_accepted");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't do that.");
    }
  }

  async function chooseCommitment(value: Commitment) {
    try {
      await setCommitment(value);
      void track("partner_commitment_set", { kind: value.kind, amount: value.amount });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save that.");
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/practice" className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Practice
      </Link>
      <h1 className="mt-1 text-3xl font-semibold leading-tight">Study partners</h1>
      <p className="mt-0.5 text-muted-foreground">Practise together. See each other&apos;s streaks and nudge each other. If a partner goes two days without practising, we&apos;ll let you know.</p>

      {failed ? (
        <div className="game-card mt-4 p-4 text-center">
          <p className="text-sm text-muted-foreground">Couldn&apos;t load your study partners.</p>
          <Button className="mt-3" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : !state ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading" />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {state.incoming.length > 0 ? (
            <section aria-label="Requests" className="game-card p-4">
              <h2 className="font-display text-lg font-semibold">Requests</h2>
              <ul className="mt-2 flex flex-col gap-2">
                {state.incoming.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 rounded-xl border-2 p-2.5">
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold">{r.name} wants to study with you</p>
                    <Button size="lg" onClick={() => respond(r.id, true)}>
                      <Check aria-hidden /> Accept
                    </Button>
                    <Button size="lg" variant="outline" aria-label={`Decline ${r.name}`} onClick={() => respond(r.id, false)}>
                      <X aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-label="Invite a friend" className="game-card p-4">
            <h2 className="font-display text-lg font-semibold">Invite a friend</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Send your link. When they join, you become study partners.</p>
            {code ? (
              <>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <a
                    href={whatsappInvite(code)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => void track("partner_invite_shared", { via: "whatsapp" })}
                    className={cn(buttonVariants({ size: "xl" }), "w-full sm:flex-1")}
                  >
                    <MessageCircle aria-hidden /> Invite on WhatsApp
                  </a>
                  <Button
                    variant="outline"
                    size="xl"
                    className="w-full sm:w-auto"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(inviteLink(code));
                        void track("partner_invite_shared", { via: "copy" });
                        toast.success("Link copied");
                      } catch {
                        toast.error("Couldn't copy. Share the code instead.");
                      }
                    }}
                  >
                    <Copy aria-hidden /> Copy link
                  </Button>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Your code: <span className="font-display text-base font-semibold tracking-widest text-foreground">{code}</span>
                </p>
              </>
            ) : (
              <div className="mt-3 h-14 animate-pulse rounded-2xl bg-muted" aria-hidden />
            )}

            <form onSubmit={sendRequest} className="mt-4 flex gap-2 border-t pt-4">
              <Input
                value={entered}
                onChange={(e) => setEntered(e.target.value.toUpperCase())}
                placeholder="Have a friend's code?"
                aria-label="A friend's code"
                maxLength={6}
                autoCapitalize="characters"
                autoComplete="off"
                className="h-12 text-base uppercase tracking-widest"
              />
              <Button type="submit" size="xl" disabled={sending || entered.trim().length < 6}>
                {sending ? <Loader2 className="animate-spin" aria-hidden /> : "Add"}
              </Button>
            </form>
          </section>

          <section aria-label="Your promise" className="game-card p-4">
            <h2 className="font-display text-lg font-semibold">Your daily promise</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">What you&apos;ll do each day. Your partners can see it.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {COMMITMENT_PRESETS.map((p) => {
                const on = state.commitment?.kind === p.value.kind && state.commitment.amount === p.value.amount;
                return (
                  <Button
                    key={p.label}
                    variant={on ? "default" : "outline"}
                    size="lg"
                    aria-pressed={on}
                    onClick={() => chooseCommitment(p.value)}
                    className="h-12"
                  >
                    {p.label}
                  </Button>
                );
              })}
            </div>
          </section>

          <section aria-label="Your study partners" className="game-card p-4">
            <h2 className="font-display text-lg font-semibold">Your study partners</h2>
            {state.partners.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {state.outgoing.length > 0
                  ? `Waiting for ${state.outgoing.map((o) => o.name).join(", ")} to accept.`
                  : "No partners yet. Invite a friend above."}
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {state.partners.map((p) => (
                  <PartnerRow
                    key={p.id}
                    partner={p}
                    onChanged={load}
                    trailing={
                      <Button
                        variant="ghost"
                        size="lg"
                        aria-label={`Remove ${p.name}`}
                        onClick={async () => {
                          if (!window.confirm(`Remove ${p.name} as a study partner?`)) return;
                          try {
                            await removePartner(p.id);
                            await load();
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Couldn't remove that.");
                          }
                        }}
                      >
                        <X aria-hidden />
                      </Button>
                    }
                  />
                ))}
              </ul>
            )}
            {state.partners.length > 0 && state.outgoing.length > 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Waiting for {state.outgoing.map((o) => o.name).join(", ")} to accept.</p>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}

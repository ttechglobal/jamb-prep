"use client";

import { Bell, Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";
import { usePwa } from "@/components/pwa/pwa-provider";
import { Button } from "@/components/ui/button";

type Kind = "install" | "reminders";

const DELAY_MS = 30_000; // a student gets settled before being asked anything
const REPEAT_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

const key = (kind: Kind) => `jp:nudge:${kind}`;

function read(kind: Kind): { shown: number; at: number } {
  try {
    return JSON.parse(localStorage.getItem(key(kind)) ?? "") as { shown: number; at: number };
  } catch {
    return { shown: 0, at: 0 };
  }
}

function due(kind: Kind) {
  const { shown, at } = read(kind);
  return Date.now() - at >= (shown === 0 ? 0 : REPEAT_AFTER_MS);
}

function markShown(kind: Kind) {
  try {
    localStorage.setItem(key(kind), JSON.stringify({ shown: read(kind).shown + 1, at: Date.now() }));
    sessionStorage.setItem("jp:nudged", "1");
  } catch {
    // Private mode: the nudge may repeat, which is harmless.
  }
}

const nudgedThisSession = () => {
  try {
    return sessionStorage.getItem("jp:nudged") === "1";
  } catch {
    return false;
  }
};

/**
 * A soft ask that slides up inside the app, at most one per visit. We ask in our own words first
 * (what the student gets), and only open the browser's own permission box once they say yes, because
 * a browser remembers a "Block" and never asks again.
 *
 * Order: "install the app" on the first visit, "turn on reminders" on a later visit, or sooner when
 * installing isn't possible. Each comes back every 3 days until it is done; there is no cap.
 */
export function AppNudges() {
  const pwa = usePwa();
  const [kind, setKind] = useState<Kind | null>(null);

  const installable = pwa.canInstall || pwa.needsIosSteps;
  const remindable = pwa.reminders === "off";

  useEffect(() => {
    if (kind || nudgedThisSession()) return;
    const id = window.setTimeout(() => {
      const next: Kind | null = installable && due("install") ? "install" : remindable && due("reminders") ? "reminders" : null;
      if (!next) return;
      markShown(next);
      setKind(next);
    }, DELAY_MS);
    return () => window.clearTimeout(id);
  }, [kind, installable, remindable]);

  // Once the thing has been done (installed, or reminders on), the sheet goes away by itself.
  const finished = (kind === "install" && !installable) || (kind === "reminders" && !remindable);
  if (!kind || finished) return null;

  const close = () => setKind(null);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 p-3 sm:left-auto sm:right-4 sm:max-w-sm sm:p-0 sm:pb-4">
      <section
        role="dialog"
        aria-label={kind === "install" ? "Install JAMB Prep" : "Practice reminders"}
        className="game-card pointer-events-auto relative flex items-start gap-3 p-4 shadow-lg animate-in fade-in slide-in-from-bottom-4 motion-reduce:animate-none"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold-ink">
          {kind === "install" ? <Download className="size-5" aria-hidden /> : <Bell className="size-5" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1 pr-8">
          {kind === "install" ? (
            <>
              <h2 className="text-lg font-semibold leading-tight">Add JAMB Prep to your phone</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {pwa.canInstall ? (
                  "Open it from your home screen and practise in seconds."
                ) : (
                  <span className="inline-flex flex-wrap items-center gap-1">
                    Tap <Share className="size-4" aria-label="Share" /> then &ldquo;Add to Home Screen&rdquo;.
                  </span>
                )}
              </p>
              <div className="mt-3 flex gap-2">
                {pwa.canInstall ? (
                  <Button size="lg" onClick={() => pwa.install().then(close)}>
                    Install app
                  </Button>
                ) : null}
                <Button variant="ghost" size="lg" onClick={close}>
                  {pwa.canInstall ? "Not now" : "Got it"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold leading-tight">Never miss a day of practice</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Get a short reminder to practise and to keep your streak alive. Turn it off any time in Profile.
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="lg" disabled={pwa.busy} onClick={() => pwa.toggleReminders().then(close)}>
                  Turn on reminders
                </Button>
                <Button variant="ghost" size="lg" onClick={close}>
                  Not now
                </Button>
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-1 top-1 grid size-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-4" aria-hidden />
        </button>
      </section>
    </div>
  );
}

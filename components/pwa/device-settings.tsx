"use client";

import { Bell, BellOff, Download, Share } from "lucide-react";
import { usePwa } from "@/components/pwa/pwa-provider";
import { Button } from "@/components/ui/button";

/** The Profile page's home for the app and reminder options, so they can always be found again. */
export function DeviceSettings() {
  const pwa = usePwa();

  return (
    <section className="game-card divide-y-2 p-4" aria-labelledby="device-title">
      <h2 id="device-title" className="pb-2 text-lg font-semibold">
        App &amp; reminders
      </h2>

      <div className="flex items-center gap-3 py-3">
        <Download className="size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-tight">Install the app</p>
          <p className="text-sm text-muted-foreground">
            {pwa.installed ? (
              "JAMB Prep is on this device."
            ) : pwa.canInstall ? (
              "Open it from your home screen, like any app."
            ) : pwa.needsIosSteps ? (
              <span className="inline-flex flex-wrap items-center gap-1">
                Tap <Share className="size-4" aria-label="Share" /> then &ldquo;Add to Home Screen&rdquo;.
              </span>
            ) : (
              "Use your browser menu and choose Install or Add to Home Screen."
            )}
          </p>
        </div>
        {pwa.canInstall ? (
          <Button variant="outline" size="lg" onClick={pwa.install}>
            Install
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-3 pt-3">
        {pwa.reminders === "on" ? (
          <Bell className="size-5 shrink-0 text-primary" aria-hidden />
        ) : (
          <BellOff className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-tight">Daily reminders</p>
          <p className="text-sm text-muted-foreground">
            {pwa.reminders === "on" && "On. We nudge you to practise and protect your streak."}
            {pwa.reminders === "off" && "Get a nudge to practise each day."}
            {pwa.reminders === "blocked" && "Blocked in your browser. Allow notifications for this site in its settings, then come back."}
            {pwa.reminders === "unsupported" &&
              (pwa.needsIosSteps
                ? "On iPhone, add the app to your Home Screen first, then reminders can be turned on."
                : "This browser does not support reminders.")}
          </p>
        </div>
        {pwa.reminders === "on" || pwa.reminders === "off" ? (
          <Button variant={pwa.reminders === "on" ? "outline" : "default"} size="lg" disabled={pwa.busy} onClick={pwa.toggleReminders}>
            {pwa.reminders === "on" ? "Turn off" : "Turn on"}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import { useAppState } from "@/lib/app-state";
import { currentSubscription, disableReminders, enableReminders, pushSupported, relinkReminders } from "@/lib/pwa/push";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type ReminderState = "unsupported" | "off" | "on" | "blocked";

interface PwaState {
  /** The browser has offered its install dialog and we can open it. */
  canInstall: boolean;
  /** iPhones and iPads have no install dialog: the student adds the app from the Share menu. */
  needsIosSteps: boolean;
  installed: boolean;
  /** This page is running as the installed app (opened from the home screen), not in a browser tab. */
  standalone: boolean;
  install(): Promise<void>;
  reminders: ReminderState;
  busy: boolean;
  toggleReminders(): Promise<void>;
}

const Ctx = createContext<PwaState | null>(null);

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const { account } = useAppState();
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [reminders, setReminders] = useState<ReminderState>("unsupported");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setStandalone(standalone);
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Works out whether this device already has reminders on, and relinks it to whoever is signed in.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pushSupported()) return setReminders("unsupported");
      if (Notification.permission === "denied") return setReminders("blocked");
      const sub = await currentSubscription();
      if (cancelled) return;
      setReminders(sub && Notification.permission === "granted" ? "on" : "off");
      if (sub && account) await relinkReminders().catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [account]);

  const install = useCallback(async () => {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
      void track("install_accepted");
    }
    setEvent(null);
  }, [event]);

  const toggleReminders = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (reminders === "on") {
        await disableReminders();
        setReminders("off");
      } else if (reminders === "off") {
        const result = await enableReminders();
        setReminders(result === "on" ? "on" : "blocked");
        if (result === "on") {
          toast.success("Reminders are on");
          void track("reminders_enabled");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't change reminders. Try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, reminders]);

  const value = useMemo<PwaState>(
    () => ({
      canInstall: !!event && !installed,
      needsIosSteps: ios && !installed,
      installed,
      standalone,
      install,
      reminders,
      busy,
      toggleReminders,
    }),
    [event, installed, standalone, ios, install, reminders, busy, toggleReminders],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePwa() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePwa must be used inside PwaProvider");
  return ctx;
}

"use client";

import type { AuthError, Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { data } from "@/lib/data";
import { emptyProgress } from "@/lib/game/rules";
import { releaseReminders } from "@/lib/pwa/push";
import { currentSession, supabase } from "@/lib/supabase/client";
import type { PlayerProgress, Profile } from "@/lib/types";

interface Account {
  email: string;
}

export type RegisterResult = "ready" | "confirm_email";

interface AppState {
  hydrated: boolean;
  /** Null for guests, who are anonymous users until they register. */
  account: Account | null;
  profile: Profile | null;
  isGuest: boolean;
  progress: PlayerProgress;
  setProgress(progress: PlayerProgress): void;
  register(email: string, password: string): Promise<RegisterResult>;
  login(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  saveProfile(profile: Profile): Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

function friendlyAuthError(error: AuthError) {
  const code = error.code ?? "";
  if (code === "invalid_credentials") return "That email or password is incorrect.";
  if (code === "email_not_confirmed") return "Confirm your email first, using the link we sent you.";
  if (code === "email_exists" || code === "user_already_exists") return "That email already has an account. Sign in instead.";
  if (code === "weak_password") return "Choose a stronger password.";
  if (code.includes("rate_limit")) return "Too many attempts. Wait a few minutes and try again.";
  return "That didn't work. Check your connection and try again.";
}

const redirectTo = (path: string) => `${window.location.origin}${path}`;

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [progress, setProgress] = useState<PlayerProgress>(emptyProgress);
  // Token refreshes also fire auth events. Only a different user needs a reload.
  const loaded = useRef<string | null | undefined>(undefined);

  const load = useCallback(async (session: Session | null) => {
    const key = session ? `${session.user.id}:${session.user.is_anonymous}` : null;
    if (loaded.current === key) return;
    loaded.current = key;

    const member = session && !session.user.is_anonymous ? session.user : null;
    setAccount(member ? { email: member.email ?? "" } : null);

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const [nextProgress, nextProfile] = await Promise.all([data.getProgress(), member ? data.getProfile() : null]);
        setProgress(nextProgress);
        setProfile(nextProfile);
        setHydrated(true);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 1200));
      }
    }
    // Stay unhydrated rather than sending a returning student back through setup.
    loaded.current = undefined;
    toast.error("Couldn't load your account. Check your connection and refresh.");
  }, []);

  useEffect(() => {
    let cancelled = false;
    currentSession().then((session) => {
      if (!cancelled) void load(session);
    });
    const { data: listener } = supabase().auth.onAuthStateChange((_event, session) => {
      // Supabase holds a lock during this callback, so its own calls must wait until it ends.
      setTimeout(() => void load(session), 0);
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [load]);

  const value = useMemo<AppState>(
    () => ({
      hydrated,
      account,
      profile,
      isGuest: account === null,
      progress,
      setProgress,

      async register(email, password) {
        const auth = supabase().auth;
        const session = await currentSession();
        const options = { emailRedirectTo: redirectTo("/onboarding") };

        // Upgrades the guest in place, so practice done before registering is kept.
        if (session?.user.is_anonymous) {
          const { data: updated, error } = await auth.updateUser({ email, password }, options);
          if (error) throw new Error(friendlyAuthError(error));
          if (updated.user.is_anonymous || updated.user.new_email) return "confirm_email";
          const { data: refreshed } = await auth.refreshSession();
          await load(refreshed.session);
          return "ready";
        }

        const { data: created, error } = await auth.signUp({ email, password, options });
        if (error) throw new Error(friendlyAuthError(error));
        if (!created.session) return "confirm_email";
        await load(created.session);
        return "ready";
      },

      async login(email, password) {
        const { data: signedIn, error } = await supabase().auth.signInWithPassword({ email, password });
        if (error) throw new Error(friendlyAuthError(error));
        await load(signedIn.session);
      },

      async signOut() {
        await releaseReminders();
        await supabase().auth.signOut({ scope: "local" });
        await load(null);
        setProfile(null);
        setProgress(emptyProgress());
      },

      async saveProfile(next) {
        await data.saveProfile(next);
        setProfile(next);
      },
    }),
    [hydrated, account, profile, progress, load],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppState must be used inside AppStateProvider");
  return ctx;
}

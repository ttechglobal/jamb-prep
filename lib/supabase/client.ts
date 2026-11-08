import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Browser client. It only ever holds the publishable key: row-level security does the rest. */
export function supabase() {
  client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  return client;
}

let lastWarm = 0;

/**
 * Opens (or keeps open) the secure connection to the server ahead of a request the student is about
 * to make. A call on a cold connection pays for the handshake first, which is most of the pause
 * after pressing Check. Safe to call often: it sends at most one small request every 15 seconds.
 */
export function warmConnection() {
  const now = Date.now();
  if (now - lastWarm < 15_000) return;
  lastWarm = now;
  fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
    method: "GET",
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
  }).catch(() => {});
}

export async function currentSession(): Promise<Session | null> {
  const { data } = await supabase().auth.getSession();
  return data.session;
}

let creatingGuest: Promise<Session> | null = null;

/**
 * Guests are real anonymous users, created at their first round rather than on page load,
 * so a visitor who only reads the landing page leaves nothing behind.
 */
export async function ensureSession(): Promise<Session> {
  const session = await currentSession();
  if (session) return session;
  creatingGuest ??= supabase()
    .auth.signInAnonymously()
    .then(({ data, error }) => {
      creatingGuest = null;
      if (error || !data.session) throw new Error("Couldn't start practice. Check your connection and try again.");
      return data.session;
    });
  return creatingGuest;
}

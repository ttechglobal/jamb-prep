import { supabase } from "@/lib/supabase/client";

/**
 * First-party usage events, stored in our own database (the `events` table) and read on the admin page.
 * A random visitor id lets us follow one browser from the landing page to sign-up. It holds no name,
 * email or answers. Tracking must never get in the student's way, so every failure is swallowed.
 */
export type EventName =
  | "landing_view"
  | "start_click"
  | "round_started"
  | "round_completed"
  | "free_limit_reached"
  | "register_view"
  | "register_submitted"
  | "onboarding_done"
  | "game_started"
  | "game_completed"
  | "install_accepted"
  | "reminders_enabled";

const VISITOR_KEY = "jp:vid";

function visitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export async function track(name: EventName, props: Record<string, string | number | boolean> = {}) {
  try {
    const visitor = visitorId();
    if (!visitor) return;
    const { data } = await supabase().auth.getSession();
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    // keepalive lets the request finish even when the tap navigates to another page.
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/track_event`, {
      method: "POST",
      keepalive: true,
      headers: {
        apikey: key,
        "Content-Type": "application/json",
        ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
      },
      body: JSON.stringify({ p_visitor: visitor, p_name: name, p_props: props }),
    });
  } catch {
    // Never shown to the student.
  }
}

/** Like track, but at most once per browser tab session (landing page refreshes don't count twice). */
export function trackOnce(name: EventName, props: Record<string, string | number | boolean> = {}, onceKey: string = name) {
  try {
    const k = `jp:once:${onceKey}`;
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, "1");
  } catch {
    // Storage blocked: count it.
  }
  void track(name, props);
}

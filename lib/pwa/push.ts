import { supabase } from "@/lib/supabase/client";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    !!VAPID_PUBLIC_KEY &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function keyBytes(base64Url: string) {
  const padded = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

async function saveToAccount(sub: PushSubscription) {
  const json = sub.toJSON();
  const { error } = await supabase().rpc("register_push", {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
  });
  if (error) throw new Error("Couldn't turn on reminders. Check your connection and try again.");
}

/** Asks permission, subscribes this device, and links it to the signed-in student. */
export async function enableReminders(): Promise<"on" | "denied"> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY!) }));
  await saveToAccount(sub);
  return "on";
}

/** Re-links an existing subscription to whoever is signed in now (a different student may share the device). */
export async function relinkReminders() {
  const sub = await currentSubscription();
  if (sub) await saveToAccount(sub);
}

export async function disableReminders() {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase().rpc("unregister_push", { p_endpoint: sub.endpoint });
  await sub.unsubscribe();
}

/** On sign-out the device stops getting this student's reminders. Signing in again relinks it. */
export async function releaseReminders() {
  try {
    const sub = await currentSubscription();
    if (sub) await supabase().rpc("unregister_push", { p_endpoint: sub.endpoint });
  } catch {
    // Signing out must never fail because of reminders.
  }
}

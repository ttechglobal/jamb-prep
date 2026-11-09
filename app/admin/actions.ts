"use server";

import { revalidatePath } from "next/cache";
import * as webpush from "web-push";
import { adminDb, endAdminSession, isAdmin, startAdminSession } from "@/lib/admin/auth";

export interface FormState {
  error?: string;
  ok?: string;
}

const KINDS = ["morning_goal", "morning_plain", "morning_countdown", "evening_streak", "evening_nudge"];

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const { data, error } = await adminDb().rpc("admin_verify_password", { p_password: String(form.get("password") ?? "") });
  if (error) {
    return { error: error.message === "locked" ? "Too many wrong tries. Wait 15 minutes." : "Couldn't check the password. Try again." };
  }
  if (data !== true) return { error: "That password is not right." };
  await startAdminSession();
  revalidatePath("/admin", "layout");
  return {};
}

export async function logout() {
  await endAdminSession();
  revalidatePath("/admin", "layout");
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  if (!(await isAdmin())) return { error: "Sign in again." };
  const next = String(form.get("next") ?? "");
  if (next.length < 8) return { error: "Use at least 8 characters." };
  if (next !== String(form.get("confirm") ?? "")) return { error: "The two passwords don't match." };
  const { error } = await adminDb().rpc("admin_set_password", { p_new: next });
  if (error) return { error: "Couldn't change the password." };
  await endAdminSession(); // the old cookie is no longer valid anyway
  revalidatePath("/admin", "layout");
  return { ok: "Password changed. Sign in again." };
}

export async function setExamDate(_: FormState, form: FormData): Promise<FormState> {
  if (!(await isAdmin())) return { error: "Sign in again." };
  const raw = String(form.get("date") ?? "").trim();
  if (raw && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { error: "Pick a valid date." };
  const { error } = await adminDb().from("app_settings").update({ exam_date: raw || null }).eq("id", 1);
  if (error) return { error: "Couldn't save." };
  revalidatePath("/admin/notifications");
  return { ok: raw ? "Saved. Countdown messages switch on within 60 days of this date." : "Cleared. Countdown messages are off." };
}

export async function saveTemplate(_: FormState, form: FormData): Promise<FormState> {
  if (!(await isAdmin())) return { error: "Sign in again." };
  const id = String(form.get("id") ?? "");
  const kind = String(form.get("kind") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  if (!KINDS.includes(kind)) return { error: "Unknown message type." };
  if (!title || title.length > 60) return { error: "The title needs 1 to 60 characters." };
  if (!body || body.length > 160) return { error: "The message needs 1 to 160 characters." };
  const db = adminDb();
  const active = form.get("active") === "on";
  const { error } = id
    ? await db.from("reminder_templates").update({ title, body, active }).eq("id", id)
    : await db.from("reminder_templates").insert({ kind, title, body, active: true });
  if (error) return { error: "Couldn't save." };
  revalidatePath("/admin/notifications");
  return { ok: id ? "Saved." : "Added." };
}

export async function deleteTemplate(form: FormData) {
  if (!(await isAdmin())) return;
  await adminDb().from("reminder_templates").delete().eq("id", String(form.get("id") ?? ""));
  revalidatePath("/admin/notifications");
}

export async function setRemindersEnabled(form: FormData) {
  if (!(await isAdmin())) return;
  await adminDb().from("app_settings").update({ reminders_enabled: form.get("enabled") === "true" }).eq("id", 1);
  revalidatePath("/admin/notifications");
}

interface Recipient {
  sub_id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  first_name: string;
  practised_today: boolean;
}

/** Sends one notification right now to everyone, to those who haven't practised today, or to one student. */
export async function sendNow(_: FormState, form: FormData): Promise<FormState> {
  if (!(await isAdmin())) return { error: "Sign in again." };
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const audience = String(form.get("audience") ?? "all");
  const student = String(form.get("student") ?? "");
  if (!title || title.length > 60) return { error: "The title needs 1 to 60 characters." };
  if (!body || body.length > 160) return { error: "The message needs 1 to 160 characters." };
  if (!["all", "not_practised", "one"].includes(audience)) return { error: "Choose who should get it." };
  if (audience === "one" && !student) return { error: "Choose a student." };

  const { NEXT_PUBLIC_VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT: subject } = process.env;
  if (!pub || !priv || !subject) return { error: "Push keys are missing on the server." };
  webpush.setVapidDetails(subject, pub, priv);

  const db = adminDb();
  const { data, error } = await db.rpc("reminder_audience");
  if (error) return { error: "Couldn't load the students." };
  const all = (data ?? []) as Recipient[];
  const targets = all.filter((r) => (audience === "one" ? r.user_id === student : audience === "not_practised" ? !r.practised_today : true));
  if (!targets.length) return { error: "Nobody matches that choice right now." };

  let sent = 0;
  let failed = 0;
  const gone: string[] = [];
  await Promise.all(
    targets.map(async (r) => {
      const payload = JSON.stringify({
        title: title.replaceAll("{name}", r.first_name),
        body: body.replaceAll("{name}", r.first_name),
        tag: "manual",
        url: "/practice",
      });
      try {
        await webpush.sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, payload, { TTL: 6 * 3600 });
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(r.sub_id);
        else failed++;
      }
    }),
  );
  if (gone.length) await db.from("push_subscriptions").delete().in("id", gone);
  await db.from("reminder_log").insert({ slot: "manual", devices: targets.length, sent, skipped: 0, removed: gone.length, failed });
  revalidatePath("/admin/notifications");
  return { ok: `Sent to ${sent} of ${targets.length} devices.${gone.length ? ` ${gone.length} had removed the app and were cleared.` : ""}${failed ? ` ${failed} failed.` : ""}` };
}

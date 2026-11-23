import * as webpush from "web-push";
import { adminDb } from "@/lib/admin/auth";

export type PushPayload = { title: string; body: string; url: string; tag: string };

/**
 * Sends a push to every device the given students have turned reminders on for. Devices that no longer
 * exist are cleaned up. It never throws, so a failed push cannot fail the thing that asked for it.
 * Returns how many pushes went out.
 */
export async function sendPush(userIds: string[], payload: PushPayload): Promise<number> {
  const { NEXT_PUBLIC_VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT: subject } = process.env;
  if (!pub || !priv || !subject || userIds.length === 0) return 0;
  try {
    webpush.setVapidDetails(subject, pub, priv);
    const admin = adminDb();
    const { data } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", userIds);
    const gone: string[] = [];
    let sent = 0;
    await Promise.all(
      (data ?? []).map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 6 * 3600 });
          sent++;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) gone.push(s.id);
        }
      }),
    );
    if (gone.length) await admin.from("push_subscriptions").delete().in("id", gone);
    return sent;
  } catch {
    return 0;
  }
}
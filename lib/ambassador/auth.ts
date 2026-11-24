import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { adminDb } from "@/lib/admin/auth";

/**
 * Ambassadors sign in with their own email and password, apart from student accounts. A signed cookie
 * holds who they are. It is signed with a key made from their password hash, so changing a password
 * signs that ambassador out everywhere. The cookie only reaches /ambassador pages.
 */
export const AMBASSADOR_COOKIE = "jp_amb";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

const sign = (hash: string, id: string, expires: string) => createHmac("sha256", hash).update(`ambassador:${id}:${expires}`).digest("hex");

export async function startAmbassadorSession(id: string) {
  const { data } = await adminDb().from("ambassadors").select("password_hash").eq("id", id).maybeSingle();
  if (!data) return;
  const expires = String(Date.now() + SESSION_MS);
  (await cookies()).set(AMBASSADOR_COOKIE, `${id}.${expires}.${sign(data.password_hash, id, expires)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/ambassador",
    maxAge: SESSION_MS / 1000,
  });
}

export async function endAmbassadorSession() {
  (await cookies()).delete({ name: AMBASSADOR_COOKIE, path: "/ambassador" });
}

export interface Ambassador {
  id: string;
  name: string;
  email: string;
  code: string;
}

/** The signed-in ambassador, or null. Runs per request, since it depends on the cookie and the clock. */
export async function currentAmbassador(): Promise<Ambassador | null> {
  await connection();
  const value = (await cookies()).get(AMBASSADOR_COOKIE)?.value;
  const [id, expires, signature] = value?.split(".") ?? [];
  if (!id || !expires || !signature || Number(expires) < Date.now()) return null;
  const { data } = await adminDb().from("ambassadors").select("id, name, email, code, password_hash").eq("id", id).maybeSingle();
  if (!data) return null;
  const expected = Buffer.from(sign(data.password_hash, id, expires));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return { id: data.id, name: data.name, email: data.email, code: data.code };
}

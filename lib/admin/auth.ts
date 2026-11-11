import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { cookieKey, createLimiter, passwordMatches, readEnvPassword } from "@/lib/admin/env-password";

/**
 * The owner's admin area has no user accounts: one password. If ADMIN_PASSWORD is set in the
 * environment (.env.local) that is the password. Otherwise it is the one kept in the database as a
 * bcrypt hash. Signing in sets a signed cookie, signed with a value derived from the password, so
 * changing the password signs every browser out.
 */
export const ADMIN_COOKIE = "jp_admin";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

/** Service-role client: bypasses row-level security. Server only. */
export function adminDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const sign = (hash: string, expires: string) => createHmac("sha256", hash).update(`admin:${expires}`).digest("hex");

const limiter = createLimiter();

/** True when the password comes from ADMIN_PASSWORD, which then replaces the database one. */
export function usingEnvPassword() {
  return readEnvPassword().password !== null;
}

/** Checks a typed password against ADMIN_PASSWORD, with a lockout after repeated wrong guesses. */
export function verifyEnvPassword(given: string): "ok" | "wrong" | "locked" | "not_configured" | "too_short" {
  const { password, problem } = readEnvPassword();
  if (problem === "too_short") return "too_short";
  if (!password) return "not_configured";
  if (limiter.locked()) return "locked";
  if (passwordMatches(given, password)) {
    limiter.ok();
    return "ok";
  }
  limiter.fail();
  return "wrong";
}

async function passwordHash() {
  const env = readEnvPassword();
  if (env.password) return cookieKey(env.password);
  if (env.problem) return null; // a too-short ADMIN_PASSWORD never works, and never falls back to another password
  const { data } = await adminDb().rpc("admin_password_hash");
  return typeof data === "string" ? data : null;
}

export async function startAdminSession() {
  const hash = await passwordHash();
  if (!hash) return;
  const expires = String(Date.now() + SESSION_MS);
  (await cookies()).set(ADMIN_COOKIE, `${expires}.${sign(hash, expires)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: SESSION_MS / 1000,
  });
}

export async function endAdminSession() {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
}

export async function isAdmin() {
  await connection(); // the check depends on the clock, so it runs per request, never at build time
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!value) return false;
  const [expires, signature] = value.split(".");
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  const hash = await passwordHash();
  if (!hash) return false;
  const expected = Buffer.from(sign(hash, expires));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

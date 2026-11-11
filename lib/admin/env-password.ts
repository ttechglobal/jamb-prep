/**
 * The admin password can live in .env.local as ADMIN_PASSWORD. When it is set it is the only password
 * that works, and the database copy is ignored. Pure helpers, so they can be tested without a server.
 */
import { createHash, timingSafeEqual } from "node:crypto";

const MIN_LENGTH = 8;
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

/** The configured password, or null when none is set. A set but too short value is reported, never accepted. */
export function readEnvPassword(env: Record<string, string | undefined> = process.env): { password: string | null; problem: "too_short" | null } {
  const value = env.ADMIN_PASSWORD?.trim();
  if (!value) return { password: null, problem: null };
  if (value.length < MIN_LENGTH) return { password: null, problem: "too_short" };
  return { password: value, problem: null };
}

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Compares in constant time, so the time taken says nothing about how much of the guess was right. */
export function passwordMatches(given: string, expected: string): boolean {
  return timingSafeEqual(digest(given), digest(expected));
}

/** The value the sign-in cookie is signed with. Changing the password changes it, which signs everyone out. */
export function cookieKey(password: string): string {
  return createHash("sha256").update(`jambprep-admin|${password}`).digest("hex");
}

/** Counts wrong guesses in memory. After a few it refuses for a while, whatever is typed. */
export function createLimiter(now: () => number = Date.now) {
  let failures = 0;
  let lockedUntil = 0;
  return {
    locked: () => now() < lockedUntil,
    fail() {
      failures++;
      if (failures >= MAX_FAILURES) {
        lockedUntil = now() + LOCK_MS;
        failures = 0;
      }
    },
    ok() {
      failures = 0;
      lockedUntil = 0;
    },
  };
}

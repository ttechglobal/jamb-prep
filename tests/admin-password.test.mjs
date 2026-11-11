import test from "node:test";
import assert from "node:assert/strict";
import { cookieKey, createLimiter, passwordMatches, readEnvPassword } from "../lib/admin/env-password.ts";

test("no ADMIN_PASSWORD means the database password is used", () => {
  assert.deepEqual(readEnvPassword({}), { password: null, problem: null });
  assert.deepEqual(readEnvPassword({ ADMIN_PASSWORD: "   " }), { password: null, problem: null });
});

test("a too short ADMIN_PASSWORD is reported, never accepted", () => {
  assert.deepEqual(readEnvPassword({ ADMIN_PASSWORD: "short" }), { password: null, problem: "too_short" });
});

test("a good ADMIN_PASSWORD is used, with stray spaces around it ignored", () => {
  assert.deepEqual(readEnvPassword({ ADMIN_PASSWORD: "  correct-horse-9  " }), { password: "correct-horse-9", problem: null });
});

test("only the exact password matches, whatever the length of the guess", () => {
  assert.equal(passwordMatches("correct-horse-9", "correct-horse-9"), true);
  assert.equal(passwordMatches("correct-horse-8", "correct-horse-9"), false);
  assert.equal(passwordMatches("", "correct-horse-9"), false);
  assert.equal(passwordMatches("x".repeat(500), "correct-horse-9"), false);
  assert.equal(passwordMatches("Correct-horse-9", "correct-horse-9"), false);
});

test("the cookie key changes with the password, so changing it signs everyone out", () => {
  assert.equal(cookieKey("one-password-1"), cookieKey("one-password-1"));
  assert.notEqual(cookieKey("one-password-1"), cookieKey("one-password-2"));
  assert.match(cookieKey("one-password-1"), /^[0-9a-f]{64}$/);
});

test("five wrong guesses lock sign-in for 15 minutes, a right one resets the count", () => {
  let t = 1_000_000;
  const l = createLimiter(() => t);
  for (let i = 0; i < 4; i++) l.fail();
  assert.equal(l.locked(), false);
  l.ok();
  for (let i = 0; i < 4; i++) l.fail();
  assert.equal(l.locked(), false, "the count was reset by the right password");
  l.fail();
  assert.equal(l.locked(), true);
  t += 14 * 60 * 1000;
  assert.equal(l.locked(), true);
  t += 2 * 60 * 1000;
  assert.equal(l.locked(), false);
});

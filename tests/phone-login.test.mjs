// Phone numbers as logins. Run: node --test tests/phone-login.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { accountLabel, isPhoneEmail, normalisePhone, phoneToEmail } from "../lib/auth/phone.ts";

test("Nigerian numbers are accepted however they are written", () => {
  for (const raw of ["08012345678", "0801 234 5678", "+234 801 234 5678", "2348012345678", "8012345678", "(0801) 234-5678"]) {
    assert.equal(normalisePhone(raw), "2348012345678", raw);
  }
  assert.equal(normalisePhone("07012345678"), "2347012345678");
  assert.equal(normalisePhone("09012345678"), "2349012345678");
});
test("things that are not phone numbers are refused", () => {
  for (const raw of ["", "abc", "0801234567", "080123456789", "01234567890", "me@example.com", "+447911123456", "12345"]) {
    assert.equal(normalisePhone(raw), null, raw);
  }
});

test("a phone number maps to a stand-in address and back", () => {
  const email = phoneToEmail("2348012345678");
  assert.equal(email, "2348012345678@phone.jambprep.invalid");
  assert.ok(isPhoneEmail(email));
  assert.ok(isPhoneEmail(email.toUpperCase()));
  assert.ok(!isPhoneEmail("ada@gmail.com"));
  assert.equal(accountLabel(email), "08012345678");
  assert.equal(accountLabel("ada@gmail.com"), "ada@gmail.com");
});

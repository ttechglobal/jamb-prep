/**
 * Phone numbers as logins, with no text message sent. A Nigerian number becomes a stand-in email address
 * such as 2348012345678@phone.jambprep.invalid, and the password does the rest.
 *
 * ".invalid" is reserved and can never be registered, so no one can ever receive mail sent to one of
 * these addresses. That is what keeps a reset link from reaching a stranger. It also means a phone
 * account cannot reset its password by email.
 */
const DOMAIN = "phone.jambprep.invalid";

/** A Nigerian mobile number in its full form (234 and ten digits), or null when it is not one. */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  if (!/^\d+$/.test(digits)) return null;
  let national: string;
  if (digits.length === 13 && digits.startsWith("234")) national = digits.slice(3);
  else if (digits.length === 11 && digits.startsWith("0")) national = digits.slice(1);
  else if (digits.length === 10) national = digits;
  else return null;
  // Mobile numbers begin 7, 8 or 9 (070, 080, 081, 090, 091 ...).
  return /^[789]\d{9}$/.test(national) ? `234${national}` : null;
}

export const phoneToEmail = (phone: string) => `${phone}@${DOMAIN}`;

export const isPhoneEmail = (email: string) => email.toLowerCase().endsWith(`@${DOMAIN}`);

/** What to show for an account: the phone number as people write it, or the real email. */
export function accountLabel(email: string): string {
  if (!isPhoneEmail(email)) return email;
  const phone = email.split("@")[0];
  return phone.startsWith("234") ? `0${phone.slice(3)}` : phone;
}

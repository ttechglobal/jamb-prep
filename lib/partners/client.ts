import { supabase } from "@/lib/supabase/client";

export type Commitment = { kind: "sessions" | "questions"; amount: number };
export type DayStatus = "not_yet" | "started" | "done";

export type Partner = {
  id: string;
  userId: string;
  name: string;
  streak: number;
  today: DayStatus;
  commitment: Commitment | null;
  nudgedByMe: boolean;
  /** Days since they last practised: 0 is today. Null when they never have. */
  daysAway: number | null;
};

export type PartnerEvent = { id: number; kind: "request" | "joined" | "nudge" | "practised"; name: string; at: string };

export type Partners = {
  commitment: Commitment | null;
  today: DayStatus;
  partners: Partner[];
  incoming: { id: string; name: string }[];
  outgoing: { id: string; name: string }[];
  events: PartnerEvent[];
};

export const COMMITMENT_PRESETS: { label: string; value: Commitment }[] = [
  { label: "Once a day", value: { kind: "sessions", amount: 1 } },
  { label: "Twice a day", value: { kind: "sessions", amount: 2 } },
  { label: "5 questions a day", value: { kind: "questions", amount: 5 } },
  { label: "10 questions a day", value: { kind: "questions", amount: 10 } },
];

export function commitmentLabel(c: Commitment | null) {
  if (!c) return null;
  const preset = COMMITMENT_PRESETS.find((p) => p.value.kind === c.kind && p.value.amount === c.amount);
  if (preset) return preset.label;
  return c.kind === "sessions" ? `${c.amount} rounds a day` : `${c.amount} questions a day`;
}

const MESSAGES: Record<string, string> = {
  invalid_code: "That code doesn't match anyone. Check it and try again.",
  own_code: "That's your own code. Send it to a friend instead.",
  already_partners: "You're already study partners.",
  too_many_partners: "You can have up to 5 study partners.",
  not_found: "That request isn't there any more.",
  already_practised: "They've already practised today.",
  already_nudged: "You already nudged them today.",
  account_required: "Create an account to study with a friend.",
  offline: "Something went wrong. Check your connection and try again.",
};

export async function getPartners(): Promise<Partners> {
  const [{ data, error }, gaps] = await Promise.all([supabase().rpc("get_partners"), supabase().rpc("get_partner_gaps")]);
  if (error) throw new Error("Couldn't load your study partners.");
  const result = data as Omit<Partners, "partners"> & { partners: Omit<Partner, "daysAway">[] };
  // How long each has been away is a bonus: the list still shows if it can't be read.
  const away = (gaps.error ? {} : (gaps.data ?? {})) as Record<string, { days: number | null }>;
  return { ...result, partners: result.partners.map((p) => ({ ...p, daysAway: away[p.userId]?.days ?? null })) };
}

/** A failed action, with the server's code so callers can tell a final answer from a dropped connection. */
export class PartnerError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

/** Actions that end in a push go through the server, which tells the other person. */
export async function partnerAction(
  body: { action: "request"; code: string } | { action: "accept_invite"; code: string } | { action: "respond"; id: string; accept: boolean } | { action: "nudge"; id: string } | { action: "practised" },
): Promise<{ status: string | null }> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new PartnerError(MESSAGES.account_required, "account_required");
  const res = await fetch("/api/partners", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res) throw new PartnerError(MESSAGES.offline, "offline");
  const json = (await res.json().catch(() => ({}))) as { error?: string; status?: string | null };
  if (!res.ok) throw new PartnerError(MESSAGES[json.error ?? ""] ?? MESSAGES.offline, json.error ?? "failed");
  return { status: json.status ?? null };
}

export async function myPartnerCode(): Promise<string> {
  const { data, error } = await supabase().rpc("my_partner_code");
  if (error || !data) throw new Error("Couldn't get your code.");
  return data as string;
}

export async function setCommitment(c: Commitment) {
  const { error } = await supabase().rpc("set_commitment", { p_kind: c.kind, p_amount: c.amount });
  if (error) throw new Error("Couldn't save that. Try again.");
}

export async function removePartner(id: string) {
  const { error } = await supabase().rpc("remove_partner", { p_id: id });
  if (error) throw new Error("Couldn't remove that. Try again.");
}

export async function markEventsRead() {
  await supabase().rpc("mark_partner_events_read");
}

export function inviteLink(code: string) {
  return `${window.location.origin}/join/${code}`;
}

export function whatsappInvite(code: string) {
  const text = `Let's study for JAMB together on JAMBprep. Join me: ${inviteLink(code)}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export const INVITE_KEY = "jp:invite";

/** A code is six letters or digits. Anything else in a link or in storage is ignored. */
export const cleanInviteCode = (raw: unknown) => {
  const code = String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return code.length === 6 ? code : null;
};

/** The invite this visitor came in with, if they opened a link on this device. */
export function savedInvite(): string | null {
  try {
    return cleanInviteCode(localStorage.getItem(INVITE_KEY));
  } catch {
    return null;
  }
}

/** Who an invite is from, by first name. Null when the code matches no one. */
export async function inviterName(code: string): Promise<string | null> {
  const { data, error } = await supabase().rpc("partner_code_owner", { p_code: code });
  return error ? null : ((data as string | null) ?? null);
}

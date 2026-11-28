import type { Topic } from "@/lib/types";

/**
 * EXL's topics follow the WAEC syllabus and JAMB Prep's follow JAMB's, so the names often differ a little.
 * A lesson is matched to a JAMB topic by name. Anything that does not match still shows up in Read; it
 * just offers practice for the whole subject. Add a line here to pin a lesson that matches the wrong topic or
 * none. The key is the lesson's EXL topic title and the value is the JAMB topic name.
 */
const OVERRIDES: Record<string, string> = {};

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(and|the|of|in|to|a)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const stems = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length > 2).map((w) => w.replace(/(ical|ic|al|s)$/, "")));

/** The JAMB topic that best matches any of the given EXL titles, or null. */
export function matchTopic(topics: Topic[], titles: string[]): Topic | null {
  const wanted = titles.filter(Boolean);
  for (const t of wanted) {
    const pinned = OVERRIDES[t];
    const hit = pinned && topics.find((x) => norm(x.name) === norm(pinned));
    if (hit) return hit;
  }
  const keys = wanted.map(norm).filter((k) => k.length >= 4);
  for (const k of keys) {
    const exact = topics.find((t) => norm(t.name) === k);
    if (exact) return exact;
  }
  for (const k of keys) {
    const loose = topics.find((t) => {
      const n = norm(t.name);
      return n.length >= 5 && (n.includes(k) || k.includes(n));
    });
    if (loose) return loose;
  }
  // Last resort: the same key words in a different order or form, such as "Structure of the Atom" and
  // "Atomic Structure and Bonding". At least two words, and every one of the lesson's words must appear.
  for (const t of wanted) {
    const w = stems(t);
    if (w.size < 2) continue;
    const hit = topics.find((x) => {
      const have = stems(x.name);
      return [...w].every((k) => have.has(k));
    });
    if (hit) return hit;
  }
  return null;
}

/**
 * A small in-memory cache for things the app asks for again and again. A result is kept for `ttlMs`, and
 * two callers asking at once share one request. A failed request is never kept, so the next try runs again.
 *
 * Two kinds of key:
 *  - shared: the same for everyone (topic lists, notes). Kept until they expire.
 *  - "user:" keys: belong to the signed-in student. They are dropped when someone signs in or out and when a round
 *    finishes, so one student never sees another's data and a finished round shows up at once.
 */
type Entry = { at: number; ttl: number; value: Promise<unknown> };
const store = new Map<string, Entry>();

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value as Promise<T>;
  const value = load().catch((err) => {
    if (store.get(key)?.value === value) store.delete(key);
    throw err;
  });
  store.set(key, { at: Date.now(), ttl: ttlMs, value });
  return value;
}

/** Drops every key that starts with `prefix`. */
export function invalidate(prefix: string) {
  for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k);
}

/** Everything that belongs to one student. Call it when the student changes or something they own changes. */
export const clearUserCache = () => invalidate("user:");

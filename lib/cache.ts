/**
 * A small in-memory cache for things the app asks for again and again. A result is kept for `ttlMs`, and
 * two callers asking at once share one request. A failed request is never kept, so the next try runs again.
 *
 * Two kinds of key:
 *  - shared: the same for everyone (topic lists, notes). Kept until they expire.
 *  - "user:" keys: belong to the signed-in student. They are dropped when someone signs in or out and when a round
 *    finishes, so one student never sees another's data and a finished round shows up at once.
 *
 * Shared keys can also be kept on the device (`persist`). On a slow or dropped connection the app then opens from
 * what it saw last time and quietly refreshes behind it. "user:" keys are never written to the device.
 */
type Entry = { at: number; ttl: number; value: Promise<unknown> };
const store = new Map<string, Entry>();

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const PREFIX = "jp:c1:";
/** How long a kept copy may be used while the network is slow or gone. */
const KEEP = 14 * DAY;

type Options = {
  /** Keep a copy on the device, and answer from it at once when the in-memory copy is gone. Shared keys only. */
  persist?: boolean;
};

function readKept<T>(key: string): { at: number; value: T } | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; value: T };
    return Date.now() - parsed.at < KEEP ? parsed : null;
  } catch {
    return null;
  }
}

function writeKept(key: string, value: unknown) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    // Storage full or blocked: the copy in memory is enough.
  }
}

export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>, options: Options = {}): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value as Promise<T>;

  const persist = options.persist && !key.startsWith("user:");
  const kept = persist ? readKept<T>(key) : null;

  const fresh = load().then((v) => {
    if (persist) writeKept(key, v);
    return v;
  });

  // A kept copy answers straight away. The refresh still runs, so the next visit has newer data.
  if (kept) {
    const value = Promise.resolve(kept.value);
    store.set(key, { at: kept.at, ttl: ttlMs, value });
    // Recent enough: no refresh needed yet. Older: refresh in the background and remember the result.
    if (Date.now() - kept.at >= ttlMs) {
      fresh
        .then((v) => store.set(key, { at: Date.now(), ttl: ttlMs, value: Promise.resolve(v) }))
        .catch(() => {});
    } else {
      fresh.catch(() => {});
    }
    return value;
  }

  const value = fresh.catch((err) => {
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

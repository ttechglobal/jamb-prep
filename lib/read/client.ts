import { HOUR, MINUTE, cached } from "@/lib/cache";
import type { ReadCatalogue, ReadLesson } from "./types";

export function getReadCatalogue(): Promise<ReadCatalogue> {
  return cached("read:catalogue", 5 * MINUTE, async () => {
    const res = await fetch("/api/read/catalogue");
    if (!res.ok) throw new Error("Couldn't load the notes. Check your connection and try again.");
    return res.json();
  });
}

/** Null when the lesson is gone (unpublished) rather than an error. */
export function getReadLesson(id: string): Promise<ReadLesson | null> {
  return cached(`read:lesson:${id}`, HOUR, async () => {
    const res = await fetch(`/api/read/lesson/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("Couldn't load this lesson. Check your connection and try again.");
    return res.json();
  });
}

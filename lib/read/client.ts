import type { ReadCatalogue, ReadLesson } from "./types";

export async function getReadCatalogue(): Promise<ReadCatalogue> {
  const res = await fetch("/api/read/catalogue");
  if (!res.ok) throw new Error("Couldn't load the notes. Check your connection and try again.");
  return res.json();
}

/** Null when the lesson is gone (unpublished) rather than an error. */
export async function getReadLesson(id: string): Promise<ReadLesson | null> {
  const res = await fetch(`/api/read/lesson/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Couldn't load this lesson. Check your connection and try again.");
  return res.json();
}

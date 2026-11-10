/**
 * Reviewed mapping from MyQuest subject names to our subject ids. Set by hand, once.
 * A subject missing from this list is not in our bank yet, so its papers are never published
 * until someone adds it here on purpose.
 */
export const MYQUEST_SUBJECTS: Record<string, string> = {
  Accounting: "accounting",
  Biology: "biology",
  Chemistry: "chemistry",
  Commerce: "commerce",
  "Christian Religious Knowledge": "crk",
  Economics: "economics",
  Government: "government",
  "Literature in English": "literature",
  Mathematics: "mathematics",
  Physics: "physics",
  "Use of English": "english",
};

/** The MyQuest name for one of our subject ids, or null when MyQuest has no match. */
export function providerName(subjectId: string): string | null {
  return Object.entries(MYQUEST_SUBJECTS).find(([, id]) => id === subjectId)?.[0] ?? null;
}

/** MyQuest lists JAMB papers for these years. A year with no questions in our bank is a gap to fill. */
export const JAMB_FIRST_YEAR = 1999;
export const JAMB_LAST_YEAR = 2026;

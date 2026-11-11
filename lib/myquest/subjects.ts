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

/**
 * A prescribed book. MyQuest sells its questions as a subject of their own, but for students they are
 * Use of English questions about the set text, so they are stored under English with a link to the book.
 * `key` stands in for a subject id in the import screens.
 */
export interface SetText {
  key: string;
  provider: string;
  subjectId: string;
  title: string;
  author: string;
  /** The years MyQuest has this book for. Other years are not offered. */
  years: string[];
}
export const SET_TEXTS: SetText[] = [
  { key: "lekki-headmaster", provider: "The Lekki Headmaster", subjectId: "english", title: "The Lekki Headmaster", author: "Kabir Alabi Garba", years: ["2024", "2025"] },
];

export const setTextByKey = (key: string) => SET_TEXTS.find((t) => t.key === key) ?? null;
export const setTextByProvider = (name: string) => SET_TEXTS.find((t) => t.provider === name) ?? null;

/** Our subject id for a MyQuest name, including set texts. Null when we do not teach it. */
export function subjectForProvider(name: string): string | null {
  return MYQUEST_SUBJECTS[name] ?? setTextByProvider(name)?.subjectId ?? null;
}

/** The MyQuest name for something chosen on the import screen: one of our subject ids or a set text key. */
export function providerFor(key: string): string | null {
  return setTextByKey(key)?.provider ?? providerName(key);
}

/**
 * Questions about a book to be read (Literature and the set texts) cannot be checked by anyone who has
 * not read the book, so the source's answer key stands. The AI only writes the explanation for it.
 */
export function usesSourceKey(subjectId: string, providerNameOrKey?: string): boolean {
  return subjectId === "literature" || (!!providerNameOrKey && !!setTextByProvider(providerNameOrKey));
}

/** MyQuest lists JAMB papers for these years. A year with no questions in our bank is a gap to fill. */
export const JAMB_FIRST_YEAR = 1999;
export const JAMB_LAST_YEAR = 2026;

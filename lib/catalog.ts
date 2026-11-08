import type { Subject } from "@/lib/types";

/**
 * Subjects on offer, in display order. Kept in code because they rarely change and the app
 * needs them on every screen. Must match the active rows in the `subjects` table.
 */
export const SUBJECTS: Subject[] = [
  { id: "english", slug: "english", name: "Use of English", shortName: "English", isCompulsory: true },
  { id: "mathematics", slug: "mathematics", name: "Mathematics", shortName: "Maths", isCompulsory: false },
  { id: "physics", slug: "physics", name: "Physics", shortName: "Physics", isCompulsory: false },
  { id: "chemistry", slug: "chemistry", name: "Chemistry", shortName: "Chemistry", isCompulsory: false },
  { id: "biology", slug: "biology", name: "Biology", shortName: "Biology", isCompulsory: false },
  { id: "economics", slug: "economics", name: "Economics", shortName: "Economics", isCompulsory: false },
  { id: "government", slug: "government", name: "Government", shortName: "Govt", isCompulsory: false },
  { id: "literature", slug: "literature", name: "Literature in English", shortName: "Literature", isCompulsory: false },
  { id: "commerce", slug: "commerce", name: "Commerce", shortName: "Commerce", isCompulsory: false },
  { id: "accounting", slug: "accounting", name: "Accounting", shortName: "Accounting", isCompulsory: false },
  { id: "crk", slug: "crk", name: "Christian Religious Knowledge", shortName: "CRK", isCompulsory: false },
];

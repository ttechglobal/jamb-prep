import "server-only";
import { cacheLife } from "next/cache";
import { SUBJECTS } from "@/lib/catalog";
import type { Inline, Mark } from "@/lib/content/types";
import type { ReadBlock, ReadCatalogue, ReadLesson, ReadLessonSummary, ReadSection, ReadSubject } from "./types";

/**
 * EXL Learn is the source of every note. Whatever it has published shows up here: new lessons, topics and
 * subjects need no change in this app. Responses are cached for a minute or so, then fetched again.
 */
const BASE = (process.env.EXL_API_BASE || "https://exllearn.vercel.app").replace(/\/$/, "");

async function exl(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`EXL ${res.status}`);
  return res.json();
}

/** The JAMB Prep subject that matches an EXL subject, by slug first and then by name. */
function jambSubject(slug: string, name: string): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const hit = SUBJECTS.find((s) => s.slug === slug || norm(s.name) === norm(name) || norm(s.shortName) === norm(name));
  return hit?.id ?? null;
}

type RawLesson = { id: string; title: string; description?: string | null; estimatedMinutes?: number | null };
type RawTopic = { id: string; title: string; lessons?: RawLesson[]; subtopics?: RawTopic[] };

/** Every lesson under a topic, however deeply nested, each tagged with the topic it sits under. */
function lessonsOf(topic: RawTopic): ReadLessonSummary[] {
  const own = (topic.lessons ?? []).map((l) => ({
    id: l.id,
    title: l.title,
    description: l.description ?? "",
    minutes: l.estimatedMinutes ?? null,
    topicTitle: topic.title,
  }));
  return [...own, ...(topic.subtopics ?? []).flatMap(lessonsOf)];
}

export async function readCatalogue(): Promise<ReadCatalogue> {
  "use cache";
  cacheLife("minutes");
  const raw = await exl("/api/v1/catalogue");
  const subjects: ReadSubject[] = [];
  for (const s of raw.data as { slug: string; name: string; topics: RawTopic[] }[]) {
    const topics = s.topics
      .map((t) => ({ id: t.id, title: t.title, lessons: lessonsOf(t) }))
      .filter((t) => t.lessons.length > 0);
    if (topics.length) subjects.push({ slug: s.slug, name: s.name, subjectId: jambSubject(s.slug, s.name), topics });
  }
  return { subjects };
}

/* Lesson content --------------------------------------------------------------------------------------- */

const MARKS = new Set<Mark>(["bold", "italic", "underline", "double_underline", "highlight", "superscript", "subscript"]);

type RawInline = { type?: string; text?: string; marks?: string[]; expression?: string };

function inline(parts: unknown): Inline[] {
  if (typeof parts === "string") return [{ text: parts }];
  // Callout text arrives as one paragraph object that wraps the inline parts.
  if (parts && typeof parts === "object" && !Array.isArray(parts)) return inline((parts as { content?: unknown }).content);
  if (!Array.isArray(parts)) return [];
  const out: Inline[] = [];
  for (const p of parts as RawInline[]) {
    if (p.type === "math" && p.expression) out.push({ math: p.expression });
    else if (typeof p.text === "string") {
      const marks = (p.marks ?? []).filter((m): m is Mark => MARKS.has(m as Mark));
      out.push(marks.length ? { text: p.text, marks } : { text: p.text });
    }
  }
  return out;
}

type RawBlock = Record<string, unknown> & { type: string };

/** One block of a lesson as something the reader can show. Blocks it does not know are left out. */
function block(b: RawBlock): ReadBlock[] {
  switch (b.type) {
    case "concept": {
      const out: ReadBlock[] = [];
      const body = (b.body as { type?: string; content?: unknown; items?: unknown }[]) ?? [];
      const paragraphs = body.filter((x) => x.type === "paragraph" || x.content).map((x) => inline(x.content));
      if (paragraphs.length) out.push({ kind: "text", paragraphs });
      const terms = (b.keyTerms as { term: string; meaning: string }[]) ?? [];
      if (terms.length) out.push({ kind: "terms", terms });
      return out;
    }
    case "did_you_know":
      return [{ kind: "callout", tone: "know", title: (b.title as string) || "Did you know?", text: inline(b.text) }];
    case "common_mistake":
      return [{ kind: "callout", tone: "mistake", title: (b.title as string) || "Common mistake", text: inline(b.text) }];
    case "exam_tip":
      return [{ kind: "callout", tone: "tip", title: "Exam tip", text: inline(b.text) }];
    case "equation":
      return typeof b.expression === "string"
        ? [{ kind: "equation", tex: b.expression, caption: (b.caption as string) ?? "", explanation: (b.explanation as string) ?? "" }]
        : [];
    case "summary": {
      const out: ReadBlock[] = [];
      const key = (b.keyPoints as string[]) ?? [];
      if (key.length) out.push({ kind: "points", title: "Key points", items: key });
      const must = (b.mustRemember as string[] | string) ?? [];
      const mustItems = Array.isArray(must) ? must : [must];
      if (mustItems.filter(Boolean).length) out.push({ kind: "points", title: "Must remember", items: mustItems.filter(Boolean) });
      return out;
    }
    default:
      // Illustrations, quick checks and the closing knowledge check stay out of the notes.
      return [];
  }
}

export async function readLesson(id: string): Promise<ReadLesson | null> {
  "use cache";
  cacheLife("minutes");
  let raw;
  try {
    raw = await exl(`/api/v1/lessons/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
  const c = raw.content as {
    title: string;
    description?: string;
    subjectSlug?: string;
    parentSubtopic?: string;
    parentTopic?: string;
    estimatedMinutes?: number;
    steps: { id: string; title: string; kind: string; blocks: RawBlock[] }[];
  };
  const sections: ReadSection[] = c.steps
    .filter((s) => s.kind === "teaching" || s.kind === "summary")
    .map((s) => ({ id: s.id, title: s.title, blocks: s.blocks.flatMap(block) }))
    .filter((s) => s.blocks.length > 0);
  const slug = c.subjectSlug ?? "";
  return {
    id,
    title: c.title,
    description: c.description ?? "",
    minutes: c.estimatedMinutes ?? null,
    subjectSlug: slug,
    subjectId: jambSubject(slug, slug),
    topicTitle: c.parentSubtopic || c.parentTopic || "",
    groupTitle: c.parentTopic || "",
    sections,
  };
}

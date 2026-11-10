/**
 * Reads the AI's pasted reply. It never rewrites content. It tolerates only what is mechanical:
 * a code fence, words around the JSON, trailing commas, raw newlines inside strings, a LaTeX
 * backslash that was not doubled, and a reply cut off part way. Everything it changes is reported.
 */

export type RawItem = Record<string, unknown>;

export interface ParseResult {
  items: RawItem[];
  /** Plain-language notes on anything repaired or ignored. */
  warnings: string[];
  /** The reply stopped part way, so only the complete questions were kept. */
  truncated: boolean;
  /** Set when nothing usable could be read. */
  error: string | null;
}

/** LaTeX commands that start with a letter JSON also uses as an escape (b f n r t). */
const LATEX_WORDS = new Set(
  (
    "bar beta begin binom boldsymbol bullet bigcup bigcap bigg bot bmod " +
    "frac forall flat " +
    "neq ne nu nabla notin not neg ni ngtr nless nsim nrightarrow newline " +
    "right rho rangle rightarrow rceil rfloor rm " +
    "theta tau tan times text textbf textit therefore triangle top to tilde tfrac " +
    "uparrow underline underbrace upsilon"
  ).split(" "),
);

interface Repair {
  text: string;
  fixedBackslashes: number;
  fixedControls: number;
  droppedCommas: number;
}

/** One pass over the text, aware of JSON strings. */
export function repairJsonText(src: string): Repair {
  let out = "";
  let inString = false;
  let fixedBackslashes = 0;
  let fixedControls = 0;
  let droppedCommas = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (!inString) {
      if (c === '"') {
        inString = true;
        out += c;
      } else if (c === ",") {
        let j = i + 1;
        while (j < src.length && /\s/.test(src[j])) j++;
        if (src[j] === "]" || src[j] === "}") droppedCommas++;
        else out += c;
      } else out += c;
      continue;
    }
    // Inside a string.
    if (c === '"') {
      inString = false;
      out += c;
    } else if (c === "\\") {
      const next = src[i + 1];
      if (next === "\\" || next === '"' || next === "/") {
        out += c + next;
        i++;
      } else if (next === "u" && /^[0-9a-fA-F]{4}$/.test(src.slice(i + 2, i + 6))) {
        out += src.slice(i, i + 6);
        i += 5;
      } else if (next !== undefined && "bfnrt".includes(next)) {
        const word = /^[A-Za-z]+/.exec(src.slice(i + 1))?.[0] ?? "";
        if (LATEX_WORDS.has(word)) {
          // \frac, \times and friends: a LaTeX command whose backslash was not doubled.
          out += "\\\\";
          fixedBackslashes++;
        } else {
          out += c + next;
          i++;
        }
      } else {
        // Any other single backslash is not valid JSON, so it is LaTeX that was not doubled.
        out += "\\\\";
        fixedBackslashes++;
      }
    } else if (c === "\n") {
      out += "\\n";
      fixedControls++;
    } else if (c === "\t") {
      out += "\\t";
      fixedControls++;
    } else if (c === "\r") {
      fixedControls++;
    } else if (c < " ") {
      out += " ";
      fixedControls++;
    } else out += c;
  }
  return { text: out, fixedBackslashes, fixedControls, droppedCommas };
}

/** Complete objects of the top-level array, even when the array was never closed. */
function recoverObjects(s: string, arrayStart: number): { objects: string[]; closed: boolean } {
  const objects: string[] = [];
  let depth = 0;
  let inString = false;
  let objStart = -1;
  let closed = false;
  for (let i = arrayStart; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "[") depth++;
    else if (c === "{") {
      if (depth === 1) objStart = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 1 && objStart >= 0) {
        objects.push(s.slice(objStart, i + 1));
        objStart = -1;
      }
    } else if (c === "]") {
      depth--;
      if (depth === 0) {
        closed = true;
        break;
      }
    }
  }
  return { objects, closed };
}

export function parseReply(raw: string): ParseResult {
  const warnings: string[] = [];
  let text = raw.replace(/^﻿/, "").trim();
  if (!text) return { items: [], warnings, truncated: false, error: "Nothing was pasted." };

  const fenced = /```[a-zA-Z]*\s*\n?([\s\S]*?)(```|$)/.exec(text);
  if (fenced && fenced[1].trim()) {
    if (fenced.index > 0 || (fenced[2] === "```" && text.length > fenced.index + fenced[0].length)) warnings.push("Text outside the code block was ignored.");
    text = fenced[1].trim();
  }

  const start = text.search(/[\[{]/);
  if (start < 0) return { items: [], warnings, truncated: false, error: "No JSON was found in what you pasted." };
  if (start > 0) warnings.push("Text before the JSON was ignored.");
  const body = text.slice(start);

  const rep = repairJsonText(body);
  if (rep.fixedBackslashes) warnings.push(`${rep.fixedBackslashes} maths backslash${rep.fixedBackslashes === 1 ? " was" : "es were"} missing a second backslash and ${rep.fixedBackslashes === 1 ? "was" : "were"} fixed.`);
  if (rep.fixedControls) warnings.push(`${rep.fixedControls} line break${rep.fixedControls === 1 ? "" : "s"} inside text ${rep.fixedControls === 1 ? "was" : "were"} fixed.`);
  if (rep.droppedCommas) warnings.push("A trailing comma was removed.");

  const wrap = (v: unknown): RawItem[] | null => {
    if (Array.isArray(v)) return v.filter((x): x is RawItem => !!x && typeof x === "object" && !Array.isArray(x));
    if (v && typeof v === "object" && Array.isArray((v as RawItem).items)) return wrap((v as RawItem).items);
    return null;
  };

  // The whole reply as one value, trimmed back to the last closing bracket.
  const last = Math.max(rep.text.lastIndexOf("]"), rep.text.lastIndexOf("}"));
  if (last >= 0) {
    try {
      const items = wrap(JSON.parse(rep.text.slice(0, last + 1)));
      if (items) {
        if (last + 1 < rep.text.trim().length) warnings.push("Text after the JSON was ignored.");
        return { items, warnings, truncated: false, error: null };
      }
    } catch {
      // fall through to recovery
    }
  }

  // A reply cut off, or with one broken item: keep every complete object.
  const arrayStart = rep.text.startsWith("[") ? 0 : rep.text.search(/"items"\s*:\s*\[/) >= 0 ? rep.text.indexOf("[", rep.text.search(/"items"\s*:\s*\[/)) : -1;
  if (arrayStart >= 0) {
    const { objects, closed } = recoverObjects(rep.text, arrayStart);
    const items: RawItem[] = [];
    let bad = 0;
    for (const o of objects) {
      try {
        items.push(JSON.parse(o) as RawItem);
      } catch {
        bad++;
      }
    }
    if (items.length) {
      if (!closed) warnings.push("The reply was cut off. Only the complete questions were kept.");
      if (bad) warnings.push(`${bad} question${bad === 1 ? "" : "s"} could not be read and ${bad === 1 ? "was" : "were"} skipped.`);
      return { items, warnings, truncated: !closed, error: null };
    }
  }
  return { items: [], warnings, truncated: false, error: "The reply is not valid JSON and nothing could be recovered. Ask the AI to resend it." };
}

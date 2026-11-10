/**
 * Checks a downloaded image before it is kept. The file type comes from the bytes, never from
 * the server's header or the URL. SVG is allowed but must be inert: no script, no embedded
 * pages, no event handlers, no links out. The question-media bucket accepts png, jpeg, webp, svg up to 2 MB.
 */
import { createHash } from "node:crypto";

export const MAX_BYTES = 2 * 1024 * 1024;

export type MediaKind = "jpeg" | "png" | "webp" | "svg";
export const MIME: Record<MediaKind, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", svg: "image/svg+xml" };
export const EXT: Record<MediaKind, string> = { jpeg: "jpg", png: "png", webp: "webp", svg: "svg" };

export type MediaProblem = "too_large" | "empty" | "unknown_type" | "unsafe_svg" | "broken_svg";

export type MediaCheck = { ok: true; kind: MediaKind; bytes: number; sha256: string } | { ok: false; problem: MediaProblem; detail?: string };

const UNSAFE_SVG: [RegExp, string][] = [
  [/<\s*script\b/i, "script element"],
  [/<\s*foreignObject\b/i, "foreignObject"],
  [/<\s*(iframe|object|embed|audio|video)\b/i, "embedded content"],
  [/\son[a-z]+\s*=/i, "event handler"],
  [/javascript\s*:/i, "javascript: URL"],
  [/<!ENTITY/i, "entity declaration"],
  [/(?:xlink:)?href\s*=\s*["']\s*(?!#)[^"']/i, "link to something outside the file"],
  [/url\(\s*["']?\s*(?!#)[a-z]+:/i, "external url()"],
  [/@import/i, "css import"],
];

export function sniffKind(buf: Buffer): MediaKind | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  const head = buf.subarray(0, 2048).toString("utf8").replace(/^﻿/, "").trimStart();
  if (/^(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg\b/i.test(head)) return "svg";
  return null;
}

export function checkImage(buf: Buffer): MediaCheck {
  if (buf.length === 0) return { ok: false, problem: "empty" };
  if (buf.length > MAX_BYTES) return { ok: false, problem: "too_large", detail: `${buf.length} bytes` };
  const kind = sniffKind(buf);
  if (!kind) return { ok: false, problem: "unknown_type" };
  if (kind === "svg") {
    const text = buf.toString("utf8");
    if (!/<\/svg>\s*$/i.test(text.trimEnd())) return { ok: false, problem: "broken_svg", detail: "no closing </svg>" };
    for (const [re, why] of UNSAFE_SVG) if (re.test(text)) return { ok: false, problem: "unsafe_svg", detail: why };
  }
  return { ok: true, kind, bytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex") };
}

/** Where a mirrored file lives in the bucket. Named by content, so a re-run never duplicates it. */
export const mediaPath = (paperKey: string, sha256: string, kind: MediaKind) =>
  `myquest/${paperKey.replace(/[^A-Za-z0-9_.-]/g, "_")}/${sha256.slice(0, 16)}.${EXT[kind]}`;

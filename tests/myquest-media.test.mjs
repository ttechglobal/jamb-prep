import test from "node:test";
import assert from "node:assert/strict";
import { checkImage, mediaPath } from "../lib/myquest/media.ts";

const buf = (s) => Buffer.from(s, "utf8");
const svg = (inner = "") => buf(`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${inner}<circle cx="5" cy="5" r="4"/></svg>`);

test("type comes from the bytes: jpeg, png, webp", () => {
  assert.equal(checkImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46])).kind, "jpeg");
  assert.equal(checkImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])).kind, "png");
  assert.equal(checkImage(Buffer.concat([buf("RIFF"), Buffer.alloc(4), buf("WEBPVP8 ")])).kind, "webp");
});

test("an HTML error page or empty body is not an image", () => {
  assert.deepEqual(checkImage(buf("<html>Not found</html>")), { ok: false, problem: "unknown_type" });
  assert.equal(checkImage(Buffer.alloc(0)).problem, "empty");
});

test("a file over 2 MB is refused", () => {
  assert.equal(checkImage(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(2 * 1024 * 1024)])).problem, "too_large");
});

test("a plain svg passes, with or without the xml prologue", () => {
  assert.equal(checkImage(svg()).kind, "svg");
  assert.equal(checkImage(buf('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>')).ok, true);
});

test("an svg that could run code or reach out is refused", () => {
  for (const bad of ["<script>alert(1)</script>", '<circle onclick="x()"/>', '<foreignObject><div/></foreignObject>', '<image href="https://evil.test/x.png"/>', '<a xlink:href="javascript:alert(1)"/>', '<style>@import url(https://evil.test/a.css)</style>']) {
    assert.equal(checkImage(svg(bad)).problem, "unsafe_svg", bad);
  }
  assert.equal(checkImage(svg('<use href="#a"/>')).ok, true);
});

test("a truncated svg is refused", () => {
  assert.equal(checkImage(buf('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"')).problem, "broken_svg");
});

test("bucket paths are named by content and scoped by paper", () => {
  assert.equal(mediaPath("mq_JAMB_2025_Physics", "abcdef0123456789ffff", "jpeg"), "myquest/mq_JAMB_2025_Physics/abcdef0123456789.jpg");
});

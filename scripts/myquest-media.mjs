// Downloads and checks the images of normalised MyQuest papers. Local files only.
//
//   npm run mq:media                       download and verify every held figure
//   npm run mq:media -- --upload           also put the verified files in the question-media bucket
//
// Output: data/imports/myquest/media/<paper>/<hash>.<ext> and manifest.json (gitignored).
// Provider image URLs carry a token and may expire, so each file is kept the first time it is seen.
// The bucket is public, so --upload is a separate, deliberate step.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { checkImage, mediaPath, MIME } from "../lib/myquest/media.ts";

const ROOT = "data/imports/myquest";
const UPLOAD = process.argv.includes("--upload");

for (const dir of fs.existsSync(`${ROOT}/papers`) ? fs.readdirSync(`${ROOT}/papers`) : []) {
  const file = `${ROOT}/papers/${dir}/normalised.json`;
  if (!fs.existsSync(file)) continue;
  const { questions } = JSON.parse(fs.readFileSync(file, "utf8"));
  const withImage = questions.filter((q) => q.remoteImage);
  if (!withImage.length) continue;

  const outDir = `${ROOT}/media/${dir}`;
  fs.mkdirSync(outDir, { recursive: true });
  const manifestFile = `${outDir}/manifest.json`;
  const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")) : {};
  console.log(`\n${dir}: ${withImage.length} image(s)`);

  for (const q of withImage) {
    const have = manifest[q.sourceRef];
    if (have?.ok && fs.existsSync(`${outDir}/${have.file}`)) {
      console.log(`  ${q.providerId}: already stored (${have.kind}, ${have.bytes} bytes)`);
      continue;
    }
    try {
      const res = await fetch(q.remoteImage);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const check = checkImage(buf);
      if (!check.ok) {
        manifest[q.sourceRef] = { ok: false, problem: check.problem, detail: check.detail };
        console.log(`  ${q.providerId}: REJECTED ${check.problem}${check.detail ? ` (${check.detail})` : ""}`);
        continue;
      }
      const path = mediaPath(dir, check.sha256, check.kind);
      const name = path.split("/").pop();
      fs.writeFileSync(`${outDir}/${name}`, buf);
      manifest[q.sourceRef] = { ok: true, kind: check.kind, bytes: check.bytes, sha256: check.sha256, file: name, bucketPath: path, uploaded: false };
      console.log(`  ${q.providerId}: ${check.kind}, ${check.bytes} bytes`);
    } catch (e) {
      manifest[q.sourceRef] = { ok: false, problem: "download_failed", detail: e.message };
      console.log(`  ${q.providerId}: FAILED ${e.message}`);
    }
  }

  if (UPLOAD) {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
    for (const [ref, m] of Object.entries(manifest)) {
      if (!m.ok || m.uploaded) continue;
      const { error } = await db.storage.from("question-media").upload(m.bucketPath, fs.readFileSync(`${outDir}/${m.file}`), { contentType: MIME[m.kind], upsert: false });
      if (error && !/already exists|Duplicate/i.test(error.message)) console.log(`  upload ${ref}: FAILED ${error.message}`);
      else {
        m.uploaded = true;
        console.log(`  upload ${ref}: ${m.bucketPath}`);
      }
    }
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
}

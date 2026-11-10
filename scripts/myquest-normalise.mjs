// Normalises every stored MyQuest paper and prints a report. Reads and writes local files only.
//
//   npm run mq:normalise
//   npm run mq:normalise -- --paper mq_JAMB_2025_Physics
//
// Output: data/imports/myquest/papers/<paper>/normalised.json (gitignored).
import fs from "node:fs";
import { normalisePaper } from "../lib/myquest/normalise.ts";
import { parsePage } from "../lib/myquest/client.ts";

const ROOT = "data/imports/myquest/papers";
const only = process.argv.includes("--paper") ? process.argv[process.argv.indexOf("--paper") + 1] : null;

for (const dir of fs.existsSync(ROOT) ? fs.readdirSync(ROOT) : []) {
  if (only && dir !== only) continue;
  const base = `${ROOT}/${dir}`;
  const summary = JSON.parse(fs.readFileSync(`${base}/summary.json`, "utf8"));
  if (!summary.reconciliation.complete) {
    console.log(`${dir}: SKIPPED, paper is incomplete (${summary.reconciliation.issues.map((i) => i.code).join(", ")})`);
    continue;
  }
  const rows = fs
    .readdirSync(base)
    .filter((f) => /^page-\d+\.json$/.test(f))
    .sort((a, b) => parseInt(a.slice(5)) - parseInt(b.slice(5)))
    .flatMap((f) => parsePage(JSON.parse(fs.readFileSync(`${base}/${f}`, "utf8"))).rows);
  const { questions, report } = normalisePaper(summary.ref, rows);
  fs.writeFileSync(`${base}/normalised.json`, JSON.stringify({ ref: summary.ref, report, questions }, null, 2));
  console.log(`\n${dir}`);
  console.log(`  ready ${report.ready}, held ${report.held}, rejected ${report.rejected} of ${report.total}`);
  console.log(`  keys A${report.keyCounts.A} B${report.keyCounts.B} C${report.keyCounts.C} D${report.keyCounts.D}${report.keySkew ? "  <-- SKEWED" : ""}`);
  for (const [r, n] of Object.entries(report.byReason).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${r}`);
}

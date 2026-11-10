// Fetches from MyQuest into data/imports/myquest/ (gitignored). Touches no database.
//
//   npm run mq:fetch -- catalogue
//   npm run mq:fetch -- catalogue --exam JAMB
//   npm run mq:fetch -- catalogue --exam JAMB --year 2025
//   npm run mq:fetch -- paper --exam JAMB --year 2025 --subject "Use of English"
//
// Each page is written to disk as it arrives, so an interrupted paper resumes from the last
// stored page. The paper summary reports whether the pages add up. Use the values exactly as
// the catalogue prints them.
import fs from "node:fs";
import path from "node:path";
import { createClient, fetchCatalogue, fetchPaper, paperKey, parsePage, sha256 } from "../lib/myquest/client.ts";

const ROOT = "data/imports/myquest";
const args = process.argv.slice(2);
const cmd = args[0];
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const client = createClient({ apiKey: process.env.MYQUEST_API_KEY });
const write = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof data === "string" ? data : JSON.stringify(data, null, 2));
};

async function catalogue() {
  const exam = flag("exam");
  const year = flag("year");
  const kind = !exam ? "exam" : !year ? "exam_year_id" : "subject";
  const { raw, entries } = await fetchCatalogue(client, kind, { exam, exam_year_id: year });
  write(`${ROOT}/catalogue/${kind}${exam ? `-${exam}` : ""}${year ? `-${year}` : ""}.json`, raw.text);
  console.log(`${kind}: ${entries.length}`);
  for (const e of entries) console.log(`  value=${JSON.stringify(e.value)}  label=${e.label}`);
}

async function paper() {
  const exam = flag("exam");
  const year = flag("year");
  const subject = flag("subject");
  if (!exam || !year || !subject) {
    console.error('paper needs --exam, --year and --subject, exactly as the catalogue prints them');
    process.exit(1);
  }
  const ref = { exam, exam_year_id: year, subject };
  const dir = `${ROOT}/papers/${paperKey(ref).replace(/[^A-Za-z0-9_.-]/g, "_")}`;
  const result = await fetchPaper(client, ref, {
    have: (page) => {
      const file = `${dir}/page-${page}.json`;
      if (!fs.existsSync(file)) return undefined;
      const text = fs.readFileSync(file, "utf8");
      return { page, raw: { status: 200, text, json: JSON.parse(text), hash: sha256(text) }, parsed: parsePage(JSON.parse(text)) };
    },
    onPage: (p) => {
      write(`${dir}/page-${p.page}.json`, p.raw.text);
      console.log(`page ${p.page}: ${p.parsed.rows.length} rows`);
    },
  });
  const { reconciliation } = result;
  write(`${dir}/summary.json`, { ref, pages: result.pages.length, reconciliation, fetchedAt: new Date().toISOString() });
  console.log(reconciliation.complete ? `COMPLETE: ${reconciliation.fetched} rows over ${result.pages.length} page(s)` : "INCOMPLETE:");
  if (!reconciliation.complete) console.log(JSON.stringify(reconciliation.issues, null, 2));
  process.exitCode = reconciliation.complete ? 0 : 2;
}

try {
  if (cmd === "catalogue") await catalogue();
  else if (cmd === "paper") await paper();
  else {
    console.error("usage: mq:fetch -- catalogue [--exam X [--year Y]] | paper --exam X --year Y --subject S");
    process.exit(1);
  }
} catch (e) {
  console.error(`${e.kind ?? "error"}: ${e.message}`);
  process.exit(1);
}

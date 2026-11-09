// Builds docs/offline-app-design.html from the .src.html: embeds the app fonts and the learning pattern.
// Also writes docs/assets/learning-pattern.svg. Run: node scripts/build-offline-design.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const iconDir = resolve(root, "node_modules/lucide-react/dist/esm/icons");

// [icon file, colour] taken from lib/game/subject-style.ts, plus a few general learning icons.
// Kept sparse on purpose: seven icons in a 560px tile, very low strength.
const ICONS = [
  ["book-open", "#1D4ED8"], ["atom", "#C2410C"], ["leaf", "#15803D"], ["globe", "#0369A1"],
  ["flask-conical", "#BE185D"], ["lightbulb", "#D97706"], ["calculator", "#6D28D9"],
];

function nodes(name) {
  const file = resolve(iconDir, `${name}.mjs`);
  if (!existsSync(file)) return null;
  const src = readFileSync(file, "utf8");
  const start = src.indexOf("node: [");
  const end = src.indexOf("\n};", start);
  if (start < 0 || end < 0) {
    console.warn(`skipped ${name}: unexpected icon format`);
    return null;
  }
  return new Function(`return ${src.slice(start + 6, end).replace(/,\s*$/, "")}`)();
}

// Fixed positions so the tile repeats without visible seams (tile is 560 x 560).
const SPOTS = [
  [40, 50, -12], [330, 20, 10], [200, 190, -8], [450, 260, 12], [70, 330, 8], [300, 400, -10], [480, 480, 6],
];

let body = "";
ICONS.forEach(([name, color], i) => {
  const n = nodes(name);
  if (!n) return;
  const [x, y, r] = SPOTS[i];
  const inner = n.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ")}/>`).join("");
  body += `<g transform="translate(${x} ${y}) rotate(${r} 19 19) scale(1.5)" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.075">${inner}</g>`;
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="560" viewBox="0 0 560 560">${body}</svg>`;

mkdirSync(resolve(root, "docs/assets"), { recursive: true });
writeFileSync(resolve(root, "docs/assets/learning-pattern.svg"), svg);

const font = (f) => `data:font/woff2;base64,${readFileSync(resolve(root, "app/fonts", f)).toString("base64")}`;
let html = readFileSync(resolve(root, "docs/offline-app-design.src.html"), "utf8");
html = html
  .replace("__FONT_FREDOKA__", font("Fredoka.woff2"))
  .replace("__FONT_JAKARTA__", font("PlusJakartaSans.woff2"))
  .replace("__PATTERN__", `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
writeFileSync(resolve(root, "docs/offline-app-design.html"), html);
console.log("built docs/offline-app-design.html and docs/assets/learning-pattern.svg");

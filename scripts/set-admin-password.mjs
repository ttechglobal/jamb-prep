// Puts the admin password in .env.local as ADMIN_PASSWORD. Run: npm run admin:password
//
// You type it here, hidden, so it never passes through a chat. It is written only to .env.local, which
// git ignores. Restart the dev server afterwards so it is picked up. You can also edit the line by hand.
import fs from "node:fs";

const FILE = ".env.local";
// Letters, digits and these symbols are safe in an env file without quoting.
const SAFE = /^[A-Za-z0-9\-_.!@%+=:,/]{8,}$/;

if (!process.stdin.isTTY) {
  console.error("Run this in a terminal you can type in: npm run admin:password");
  process.exit(1);
}

/** Reads a line without echoing it. */
function ask(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let text = "";
    const onData = (chunk) => {
      for (const c of chunk) {
        if (c === "\r" || c === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(text);
          return;
        }
        if (c === "\u0003") process.exit(1);
        if (c === "\u007f" || c === "\b") text = text.slice(0, -1);
        else text += c;
      }
    };
    stdin.on("data", onData);
  });
}

const first = await ask("New admin password (8 or more letters, digits or - _ . ! @ % + = : , /): ");
if (!SAFE.test(first)) {
  console.error("That password is too short or has a character that does not work in .env.local (spaces, quotes, # or backslashes). Nothing was changed.");
  process.exit(1);
}
const second = await ask("Type it again: ");
if (first !== second) {
  console.error("The two did not match. Nothing was changed.");
  process.exit(1);
}

const text = fs.existsSync(FILE) ? fs.readFileSync(FILE, "utf8") : "";
const eol = text.includes("\r\n") ? "\r\n" : "\n";
const line = `ADMIN_PASSWORD=${first}`;
const next = /^ADMIN_PASSWORD=.*$/m.test(text) ? text.replace(/^ADMIN_PASSWORD=.*$/m, line) : `${text}${text && !text.endsWith("\n") ? eol : ""}${line}${eol}`;
fs.writeFileSync(FILE, next);
console.log("Done. ADMIN_PASSWORD is in .env.local. Restart the dev server, then sign in at /admin.");

// Sets (or resets) the admin password from your own terminal. Run: npm run admin:password
//
// The password is typed here and never shown or stored anywhere but the database, as a bcrypt hash.
// It does not pass through any chat. Setting it signs out every browser that was signed in.
import postgres from "postgres";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is missing from .env.local");
  process.exit(1);
}
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

const first = await ask("New admin password (at least 8 characters): ");
if (first.length < 8) {
  console.error("That is too short. Nothing was changed.");
  process.exit(1);
}
const second = await ask("Type it again: ");
if (first !== second) {
  console.error("The two did not match. Nothing was changed.");
  process.exit(1);
}

const sql = postgres(url);
try {
  await sql`select public.admin_set_password(${first})`;
  console.log("Done. The admin password is set. Sign in at /admin. You stay signed in for 30 days per browser.");
} catch (e) {
  console.error("Could not set the password:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}

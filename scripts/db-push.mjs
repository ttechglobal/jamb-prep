// Applies supabase/migrations to the project in .env.local. Run: npm run db:push
// The connection string is passed to the CLI directly, so it never appears in shell history.
import { spawnSync } from "node:child_process";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is missing from .env.local");
  process.exit(1);
}

const { status } = spawnSync("supabase", ["db", "push", "--db-url", url, "--yes"], {
  stdio: "inherit",
  shell: false,
});
process.exit(status ?? 1);

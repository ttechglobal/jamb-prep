// Setup for reminder notifications on Supabase. Safe to re-run:
//   1. stores the push keys as Edge Function secrets
//   2. deploys the send-reminders function
//   3. schedules it with pg_cron: 7:00 and 18:00 Lagos (06:00 and 17:00 UTC)
//   4. sets the admin password the first time (printed once)
// Run: npm run reminders:setup     Needs the Supabase CLI to be logged in (supabase login).
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import postgres from "postgres";

const env = process.env;
for (const k of ["SUPABASE_PROJECT_REF", "SUPABASE_DB_URL", "NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "CRON_SECRET"]) {
  if (!env[k]) {
    console.error(`${k} is missing from .env.local`);
    process.exit(1);
  }
}
const ref = env.SUPABASE_PROJECT_REF;

let cliFailed = false;
function cli(args) {
  if (cliFailed) return;
  const r = spawnSync("supabase", args, { stdio: "inherit", shell: false });
  if (r.status !== 0) cliFailed = true;
}

const sql = postgres(env.SUPABASE_DB_URL, { max: 1, prepare: false });
try {
  await sql`create extension if not exists pg_cron`;
  await sql`create extension if not exists pg_net`;

  // The cron job reads the shared secret from Vault, so it never sits in a job definition.
  await sql`delete from vault.secrets where name = 'reminders_cron_secret'`;
  await sql`select vault.create_secret(${env.CRON_SECRET}, 'reminders_cron_secret')`;

  for (const [name, schedule, slot] of [
    ["reminders-morning", "0 6 * * *", "morning"],
    ["reminders-evening", "0 17 * * *", "evening"],
  ]) {
    await sql`select cron.unschedule(jobid) from cron.job where jobname = ${name}`;
    const url = `https://${ref}.supabase.co/functions/v1/send-reminders?slot=${slot}`;
    const command = `select net.http_post(url := '${url}', headers := jsonb_build_object('x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_secret')), body := '{}'::jsonb)`;
    await sql`select cron.schedule(${name}, ${schedule}, ${command})`;
  }
  console.log("Scheduled: morning 06:00 UTC (7:00 Lagos), evening 17:00 UTC (18:00 Lagos).");

  const [{ is_set }] = await sql`select admin_password_hash is not null as is_set from public.app_settings where id = 1`;
  if (!is_set) {
    const password = randomBytes(9).toString("base64url");
    await sql`select public.admin_set_password(${password})`;
    console.log(`\nAdmin password (shown once, change it on the admin page): ${password}\n`);
  } else {
    console.log("Admin password already set; left unchanged.");
  }
} finally {
  await sql.end();
}

console.log("Setting Edge Function secrets...");
cli([
  "secrets", "set", "--project-ref", ref,
  `VAPID_PUBLIC_KEY=${env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}`,
  `VAPID_PRIVATE_KEY=${env.VAPID_PRIVATE_KEY}`,
  `VAPID_SUBJECT=${env.VAPID_SUBJECT}`,
  `CRON_SECRET=${env.CRON_SECRET}`,
]);

console.log("Deploying send-reminders...");
cli(["functions", "deploy", "send-reminders", "--project-ref", ref, "--no-verify-jwt", "--use-api"]);
if (cliFailed) {
  console.error(
    "\nThe database side is done, but the function could not be deployed. " +
      "The Supabase CLI is not logged in to the account that owns this project.\n" +
      "Run `supabase login` with that account (or set SUPABASE_ACCESS_TOKEN), then run this again.",
  );
  process.exit(1);
}

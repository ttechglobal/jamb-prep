// Schedules the study-time reminders and the two-day partner alert. Safe to re-run:
//   node --env-file=.env.local scripts/setup-study-reminders.mjs https://your-site.example
// The database calls POST <site>/api/cron/study every 15 minutes with the shared secret. The site must have
// the same CRON_SECRET, and the push keys it already uses for study partners, set in its environment.
import postgres from "postgres";

const site = (process.argv[2] ?? process.env.SITE_URL ?? "").replace(/\/+$/, "");
if (!/^https:\/\/[^/\s]+$/.test(site)) {
  console.error("Give the live site address, like: node --env-file=.env.local scripts/setup-study-reminders.mjs https://jambprep.example.com");
  process.exit(1);
}
for (const k of ["SUPABASE_DB_URL", "CRON_SECRET"]) {
  if (!process.env[k]) {
    console.error(`${k} is missing from .env.local`);
    process.exit(1);
  }
}

const sql = postgres(process.env.SUPABASE_DB_URL, { max: 1, prepare: false });
try {
  await sql`create extension if not exists pg_cron`;
  await sql`create extension if not exists pg_net`;

  // The job reads the shared secret from Vault, so it never sits in a job definition.
  await sql`delete from vault.secrets where name = 'study_cron_secret'`;
  await sql`select vault.create_secret(${process.env.CRON_SECRET}, 'study_cron_secret')`;

  const command = `select net.http_post(url := '${site}/api/cron/study', headers := jsonb_build_object('x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'study_cron_secret'), 'content-type', 'application/json'), body := '{}'::jsonb)`;
  await sql`select cron.unschedule(jobid) from cron.job where jobname = 'study-reminders'`;
  await sql`select cron.schedule('study-reminders', '*/15 * * * *', ${command})`;
  console.log(`Scheduled: every 15 minutes, calling ${site}/api/cron/study`);
} finally {
  await sql.end();
}
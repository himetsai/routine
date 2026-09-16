// Mark a list of days done for a routine — for backfilling history from another app.
//
//   DATABASE_URL=… DATABASE_AUTH_TOKEN=… node scripts/import-days.mjs --routine Gym \
//     --dates 2025-11-05,2025-11-06,… [--pause 2026-01-01:2026-01-31 …]
//
// Idempotent. Moves the routine's start back to the earliest date so the history
// counts. `--pause from:to` records a routine-level pause for spans with no data,
// so unknown months read as "paused", not "missed".
import { createClient } from "@libsql/client";

const args = process.argv.slice(2);
const opt = (name) => args.flatMap((a, i) => (a === `--${name}` ? [args[i + 1]] : []));
const routineName = opt("routine")[0];
const dates = opt("dates").flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean);
const pauses = opt("pause").map((s) => s.split(":"));
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
if (!routineName || dates.length === 0) throw new Error("usage: --routine <name> --dates YYYY-MM-DD,… [--pause from:to]");
for (const d of [...dates, ...pauses.flat()]) if (!isoDate.test(d)) throw new Error(`Bad date: ${d}`);

const db = createClient({ url: process.env.DATABASE_URL ?? "file:local.db", authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
const { rows } = await db.execute({ sql: "select id, created_on from routines where name = ? collate nocase", args: [routineName] });
const routine = rows[0];
if (!routine) throw new Error(`No routine named "${routineName}" — create it in the app first`);

const first = [...dates, ...pauses.map((p) => p[0])].sort()[0];
if (first < routine.created_on) {
  await db.execute({ sql: "update routines set created_on = ? where id = ?", args: [first, routine.id] });
  await db.execute({
    sql: "update routine_schedules set effective_from = ? where routine_id = ? and effective_from = (select min(effective_from) from routine_schedules where routine_id = ?)",
    args: [first, routine.id, routine.id],
  });
  console.log(`moved "${routineName}" start from ${routine.created_on} back to ${first}`);
}

let added = 0;
for (const date of [...new Set(dates)].sort()) {
  const res = await db.execute({
    sql: "insert into events (id, routine_id, for_date, kind, logged_at, note) values (?, ?, ?, 'done', ?, 'imported') on conflict(id) do nothing",
    args: [`import:days:${routine.id}:${date}`, routine.id, date, `${date}T12:00:00.000Z`],
  });
  added += res.rowsAffected;
}
console.log(`${dates.length} days → ${added} new completions, ${dates.length - added} already recorded`);

for (const [from, to] of pauses) {
  const res = await db.execute({
    sql: "insert into pauses (id, routine_id, start_date, end_date, note) values (?, ?, ?, ?, 'no data imported') on conflict(id) do nothing",
    args: [`import:pause:${routine.id}:${from}`, routine.id, from, to],
  });
  console.log(`pause ${from} → ${to}: ${res.rowsAffected ? "added" : "already present"}`);
}

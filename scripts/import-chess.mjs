// Import chess.com game history as completions of a daily routine.
//
//   DATABASE_URL=… DATABASE_AUTH_TOKEN=… node scripts/import-chess.mjs --user <chess.com username> \
//     [--routine chess] [--tz America/Los_Angeles] [--include-daily]
//
// Uses chess.com's public API (no auth): every month's games, each with an
// end time. A day counts when at least one game finished on it, in local
// time for `--tz`, shifted back a day when it ended before the app's day
// cutoff — the same day rule a live tap would have used. Correspondence
// ("daily") games are ignored unless `--include-daily`, since finishing one
// says little about having played that day.
//
// Idempotent: one event per day, keyed by user and date; re-runs add new days.
import { createClient } from "@libsql/client";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const user = arg("user", null);
const routineName = arg("routine", "chess");
const tz = arg("tz", "America/Los_Angeles");
const includeDaily = process.argv.includes("--include-daily");
if (!user) throw new Error("usage: --user <chess.com username> [--routine chess] [--tz Area/City] [--include-daily]");

const headers = { "User-Agent": "routine.himetsai.com importer (contact: ray at himetsai dot com)" };
async function getJson(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const db = createClient({ url: process.env.DATABASE_URL ?? "file:local.db", authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
const cutoff = (await db.execute("select day_cutoff_hour from settings where id = 1")).rows[0]?.day_cutoff_hour ?? 4;
const { rows } = await db.execute({ sql: "select id, created_on from routines where name = ? collate nocase", args: [routineName] });
const routine = rows[0];
if (!routine) throw new Error(`No routine named "${routineName}" — create it in the app first`);

const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
/** Local routine-day for an epoch-seconds timestamp. */
function routineDay(epoch) {
  const parts = Object.fromEntries(fmt.formatToParts(new Date(epoch * 1000)).map((p) => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  if (Number(parts.hour) >= cutoff) return date;
  return new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

const { archives } = await getJson(`https://api.chess.com/pub/player/${encodeURIComponent(user)}/games/archives`);
const days = new Map(); // date -> { games, firstEnd }
let total = 0;
const classes = {};
for (const url of archives) {
  const { games } = await getJson(url);
  for (const g of games) {
    if (!g.end_time) continue;
    if (g.time_class === "daily" && !includeDaily) continue;
    total++;
    classes[g.time_class] = (classes[g.time_class] ?? 0) + 1;
    const day = routineDay(g.end_time);
    const d = days.get(day) ?? { games: 0, firstEnd: g.end_time };
    d.games++;
    d.firstEnd = Math.min(d.firstEnd, g.end_time);
    days.set(day, d);
  }
}
if (days.size === 0) throw new Error(`No games found for ${user}`);

const dates = [...days.keys()].sort();
const first = dates[0];
if (first < routine.created_on) {
  await db.execute({ sql: "update routines set created_on = ? where id = ?", args: [first, routine.id] });
  await db.execute({
    sql: "update routine_schedules set effective_from = ? where routine_id = ? and effective_from = (select min(effective_from) from routine_schedules where routine_id = ?)",
    args: [first, routine.id, routine.id],
  });
  console.log(`"${routineName}" now starts ${first} (was ${routine.created_on})`);
}

let added = 0;
for (const date of dates) {
  const d = days.get(date);
  const res = await db.execute({
    sql: "insert into events (id, routine_id, for_date, kind, logged_at, note) values (?, ?, ?, 'done', ?, ?) on conflict(id) do nothing",
    args: [`import:chess:${user.toLowerCase()}:${date}`, routine.id, date, new Date(d.firstEnd * 1000).toISOString(), `${d.games} game${d.games === 1 ? "" : "s"} on chess.com`],
  });
  added += res.rowsAffected;
}

const byYear = {};
for (const date of dates) byYear[date.slice(0, 4)] = (byYear[date.slice(0, 4)] ?? 0) + 1;
console.log(`${archives.length} months, ${total} games (${Object.entries(classes).map(([k, v]) => `${k} ${v}`).join(", ")}) → ${dates.length} days (${first} → ${dates.at(-1)}); ${added} new`);
console.log("days per year:", JSON.stringify(byYear));

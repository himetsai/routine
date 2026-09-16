// Import himetsai.com posts as completions of a weekly routine.
//
//   DATABASE_URL=… DATABASE_AUTH_TOKEN=… node scripts/import-posts.mjs [--routine Shitpost] [--collection shitpost] [--site ~/himetsai.com] [--start YYYY-MM-DD]
//
// Each post is marked done on its routine-day: the wall-clock date in its
// `pubDate`, shifted back a day when it was published before the app's day
// cutoff (a 1 am Monday post is a Sunday post, exactly as a live tap would
// have recorded it). Weeks with no post that were followed by a make-up post
// get a `skip` on their Sunday — the app's own way of excusing a week — so the
// streak reflects "never missed a week's worth of posts" while the heatmap
// still shows honest publish dates. Weeks after the newest post are left alone.
//
// `--start` (a Monday) makes the routine begin that week and files any earlier
// post as that first week's post — for a history that opened on a Sunday.
//
// Idempotent: event ids derive from the slug (or the skipped week); re-runs
// realign dates and drop skips for weeks that have since gained a post.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";

const DAY = 86_400_000;
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const routineName = arg("routine", "Shitpost");
const collection = arg("collection", "shitpost");
const start = arg("start", null);
const site = arg("site", join(homedir(), "himetsai.com")).replace(/^~/, homedir());
const dir = join(site, "src/content", collection);
if (!existsSync(dir)) throw new Error(`No collection at ${dir}`);

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const addDays = (date, n) => iso(Date.parse(`${date}T00:00:00Z`) + n * DAY);
const mondayOf = (date) => addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));

const db = createClient({ url: process.env.DATABASE_URL ?? "file:local.db", authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
const cutoff = (await db.execute("select day_cutoff_hour from settings where id = 1")).rows[0]?.day_cutoff_hour ?? 4;

const posts = readdirSync(dir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_") && existsSync(join(dir, d.name, "index.mdx")))
  .map((d) => {
    const src = readFileSync(join(dir, d.name, "index.mdx"), "utf8");
    const m = src.match(/^pubDate:\s*"?(\d{4}-\d{2}-\d{2})T(\d{2})[^"\n]*"?\s*$/m);
    const draft = /^draft:\s*true\s*$/m.test(src);
    if (!m || draft) return null;
    const full = src.match(/^pubDate:\s*"?([^"\n]+)"?\s*$/m)[1].trim();
    const [, wall, hour] = m;
    return { slug: d.name, forDate: Number(hour) < cutoff ? addDays(wall, -1) : wall, loggedAt: new Date(full).toISOString() };
  })
  .filter(Boolean)
  .sort((a, b) => a.forDate.localeCompare(b.forDate) || a.loggedAt.localeCompare(b.loggedAt));
if (posts.length === 0) throw new Error("No posts found");
if (start) for (const p of posts) if (p.forDate < start) p.forDate = start;

const { rows } = await db.execute({ sql: "select id, created_on from routines where name = ? collate nocase", args: [routineName] });
const routine = rows[0];
if (!routine) throw new Error(`No routine named "${routineName}" — create it in the app first`);

const first = posts[0].forDate;
if (first !== routine.created_on) {
  await db.execute({ sql: "update routines set created_on = ? where id = ?", args: [first, routine.id] });
  await db.execute({
    sql: "update routine_schedules set effective_from = ? where routine_id = ? and effective_from = (select min(effective_from) from routine_schedules where routine_id = ?)",
    args: [first, routine.id, routine.id],
  });
  console.log(`"${routineName}" now starts ${first} (was ${routine.created_on})`);
}

for (const p of posts) {
  await db.execute({
    sql: `insert into events (id, routine_id, for_date, kind, logged_at, note) values (?, ?, ?, 'done', ?, ?)
          on conflict(id) do update set for_date = excluded.for_date, logged_at = excluded.logged_at`,
    args: [`import:${collection}:${p.slug}`, routine.id, p.forDate, p.loggedAt, p.slug],
  });
}

// Excuse gapped weeks that were made up afterwards.
const weeksWithPost = new Set(posts.map((p) => mondayOf(p.forDate)));
const skipIds = [];
for (let week = mondayOf(first); week < mondayOf(posts.at(-1).forDate); week = addDays(week, 7)) {
  if (weeksWithPost.has(week)) continue;
  const makeUp = posts.find((p) => p.forDate > addDays(week, 6));
  const id = `import:${collection}:skip:${week}`;
  skipIds.push(id);
  await db.execute({
    sql: `insert into events (id, routine_id, for_date, kind, logged_at, note) values (?, ?, ?, 'skip', ?, ?)
          on conflict(id) do update set for_date = excluded.for_date, logged_at = excluded.logged_at, note = excluded.note`,
    args: [id, routine.id, addDays(week, 6), makeUp.loggedAt, `no post this week — made up by ${makeUp.slug} on ${makeUp.forDate}`],
  });
}
const stale = (await db.execute({ sql: "select id from events where routine_id = ? and id like ?", args: [routine.id, `import:${collection}:skip:%`] })).rows
  .map((r) => r.id)
  .filter((id) => !skipIds.includes(id));
for (const id of stale) await db.execute({ sql: "delete from events where id = ?", args: [id] });

console.log(`${posts.length} posts (${first} → ${posts.at(-1).forDate}) on their publish days; ${skipIds.length} gapped weeks excused as skips${stale.length ? `; ${stale.length} stale skips removed` : ""}`);

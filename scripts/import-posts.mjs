// Import himetsai.com posts as completions of a weekly routine.
//
//   DATABASE_URL=… DATABASE_AUTH_TOKEN=… node scripts/import-posts.mjs [--routine Shitpost] [--collection shitpost] [--site ~/himetsai.com] [--exact-dates]
//
// A weekly post is a deliverable: publishing a day late (or a Sunday early) is
// still that week's post. So by default posts are laid onto consecutive
// Monday-weeks ending with the newest post's week — the newest post fulfils its
// own week, the one before it the week before, and so on. A post keeps its real
// date when that date already falls in its week; otherwise `for_date` becomes
// the Monday (posted early) or Sunday (posted late) of the week it fulfilled,
// and `logged_at` keeps the true publish time. `--exact-dates` disables this.
//
// Idempotent: event ids derive from the slug, and re-runs realign dates.
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
const exact = process.argv.includes("--exact-dates");
const site = arg("site", join(homedir(), "himetsai.com")).replace(/^~/, homedir());
const dir = join(site, "src/content", collection);
if (!existsSync(dir)) throw new Error(`No collection at ${dir}`);

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const mondayOf = (date) => {
  const t = Date.parse(`${date}T00:00:00Z`);
  return iso(t - ((new Date(t).getUTCDay() + 6) % 7) * DAY);
};
const addDays = (date, n) => iso(Date.parse(`${date}T00:00:00Z`) + n * DAY);

const posts = readdirSync(dir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_") && existsSync(join(dir, d.name, "index.mdx")))
  .map((d) => {
    const src = readFileSync(join(dir, d.name, "index.mdx"), "utf8");
    const m = src.match(/^pubDate:\s*"?([^"\n]+)"?\s*$/m);
    const draft = /^draft:\s*true\s*$/m.test(src);
    return m && !draft ? { slug: d.name, pubDate: m[1].trim() } : null;
  })
  .filter(Boolean)
  .map((p) => ({ ...p, published: p.pubDate.slice(0, 10), loggedAt: new Date(p.pubDate).toISOString() }))
  .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.published))
  .sort((a, b) => a.published.localeCompare(b.published));
if (posts.length === 0) throw new Error("No posts found");

// Assign each post the week it fulfilled.
const lastWeek = mondayOf(posts.at(-1).published);
let shifted = 0;
for (const [i, p] of posts.entries()) {
  if (exact) {
    p.forDate = p.published;
    continue;
  }
  const week = addDays(lastWeek, -7 * (posts.length - 1 - i));
  const actualWeek = mondayOf(p.published);
  p.forDate = actualWeek === week ? p.published : actualWeek < week ? week : addDays(week, 6);
  if (p.forDate !== p.published) shifted++;
}

const db = createClient({ url: process.env.DATABASE_URL ?? "file:local.db", authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
const { rows } = await db.execute({ sql: "select id, created_on from routines where name = ? collate nocase", args: [routineName] });
const routine = rows[0];
if (!routine) throw new Error(`No routine named "${routineName}" — create it in the app first`);

const first = posts.map((p) => p.forDate).sort()[0];
if (first !== routine.created_on) {
  await db.execute({ sql: "update routines set created_on = ? where id = ?", args: [first, routine.id] });
  await db.execute({
    sql: "update routine_schedules set effective_from = ? where routine_id = ? and effective_from = (select min(effective_from) from routine_schedules where routine_id = ?)",
    args: [first, routine.id, routine.id],
  });
  console.log(`"${routineName}" now starts ${first} (was ${routine.created_on})`);
}

let added = 0;
for (const p of posts) {
  const res = await db.execute({
    sql: `insert into events (id, routine_id, for_date, kind, logged_at, note) values (?, ?, ?, 'done', ?, ?)
          on conflict(id) do update set for_date = excluded.for_date, logged_at = excluded.logged_at`,
    args: [`import:${collection}:${p.slug}`, routine.id, p.forDate, p.loggedAt, p.slug],
  });
  added += res.rowsAffected;
}
console.log(`${posts.length} posts (${posts[0].published} → ${posts.at(-1).published}), ${shifted} assigned to an adjacent week; ${added} rows written`);

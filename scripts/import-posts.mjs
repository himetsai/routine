// Import himetsai.com posts as completions of a weekly routine.
//
//   DATABASE_URL=… DATABASE_AUTH_TOKEN=… node scripts/import-posts.mjs [--routine Shitpost] [--collection shitpost] [--site ~/himetsai.com]
//
// Idempotent: event ids are derived from the post slug, so re-running only adds
// new posts. The routine's start date is moved back to the first post if needed
// so the history counts. The day of a post is the date written in its
// `pubDate` (the author's local wall-clock time), not a UTC conversion.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const routineName = arg("routine", "Shitpost");
const collection = arg("collection", "shitpost");
const site = arg("site", join(homedir(), "himetsai.com")).replace(/^~/, homedir());
const dir = join(site, "src/content", collection);
if (!existsSync(dir)) throw new Error(`No collection at ${dir}`);

const posts = readdirSync(dir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_") && existsSync(join(dir, d.name, "index.mdx")))
  .map((d) => {
    const src = readFileSync(join(dir, d.name, "index.mdx"), "utf8");
    const m = src.match(/^pubDate:\s*"?([^"\n]+)"?\s*$/m);
    const draft = /^draft:\s*true\s*$/m.test(src);
    return m && !draft ? { slug: d.name, pubDate: m[1].trim() } : null;
  })
  .filter(Boolean)
  .map((p) => ({ ...p, forDate: p.pubDate.slice(0, 10), loggedAt: new Date(p.pubDate).toISOString() }))
  .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.forDate))
  .sort((a, b) => a.forDate.localeCompare(b.forDate));

if (posts.length === 0) throw new Error("No posts found");

const db = createClient({ url: process.env.DATABASE_URL ?? "file:local.db", authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
const { rows } = await db.execute({ sql: "select id, created_on from routines where name = ? collate nocase", args: [routineName] });
const routine = rows[0];
if (!routine) throw new Error(`No routine named "${routineName}" — create it in the app first`);

const first = posts[0].forDate;
if (first < routine.created_on) {
  await db.execute({ sql: "update routines set created_on = ? where id = ?", args: [first, routine.id] });
  await db.execute({
    sql: "update routine_schedules set effective_from = ? where routine_id = ? and effective_from = (select min(effective_from) from routine_schedules where routine_id = ?)",
    args: [first, routine.id, routine.id],
  });
  console.log(`moved "${routineName}" start from ${routine.created_on} back to ${first}`);
}

let added = 0;
for (const p of posts) {
  const res = await db.execute({
    sql: "insert into events (id, routine_id, for_date, kind, logged_at, note) values (?, ?, ?, 'done', ?, ?) on conflict(id) do nothing",
    args: [`import:${collection}:${p.slug}`, routine.id, p.forDate, p.loggedAt, p.slug],
  });
  added += res.rowsAffected;
}
console.log(`${posts.length} posts (${first} → ${posts.at(-1).forDate}); ${added} new events, ${posts.length - added} already imported`);

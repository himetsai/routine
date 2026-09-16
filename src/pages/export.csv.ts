import type { APIRoute } from "astro";
import { db } from "../db";
import { loadSnapshot } from "../db/load";
import { dayStatus, eachDay, Index, localDate } from "../engine";
import { isOwner } from "../server/session";

export const prerender = false;

/** One row per routine per day it existed: the shape a notebook wants. */
export const GET: APIRoute = async ({ cookies, url }) => {
  if (!isOwner(cookies)) return new Response("Sign in first", { status: 401 });
  const today = url.searchParams.get("today") ?? localDate(new Date());
  const idx = new Index(await loadSnapshot(db));
  const rows = ["routine_id,routine,cadence,importance,date,status"];
  for (const r of idx.routines) {
    const last = r.archivedOn && r.archivedOn <= today ? r.archivedOn : today;
    for (const date of eachDay(r.createdOn, last)) {
      const cadence = idx.cadenceFor(r, date);
      const status = dayStatus(idx, r, date, today);
      if (status === "inactive") continue;
      const cad = cadence?.kind === "weekly" ? `weekly:${cadence.timesPerWeek}` : "daily";
      rows.push([r.id, csv(r.name), cad, r.importance, date, status].join(","));
    }
  }
  return new Response(rows.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="routine-${today}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
};

function csv(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

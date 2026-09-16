import type { APIRoute } from "astro";
import { db } from "../../db";
import { loadSnapshot } from "../../db/load";

export const prerender = false;

/**
 * The whole dataset — routines, schedules, events, pauses, settings. Reads are
 * public by design. Anonymous visitors hit the CDN-cached copy; the owner's
 * client appends a cache-busting query so it always sees fresh data.
 */
export const GET: APIRoute = async ({ url }) => {
  const snapshot = await loadSnapshot(db);
  const fresh = url.searchParams.has("fresh");
  return new Response(JSON.stringify(snapshot), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": fresh ? "private, no-store" : "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
};

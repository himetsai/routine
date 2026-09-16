import type { APIRoute } from "astro";
import { db } from "../db";
import { loadSnapshot } from "../db/load";
import { isOwner } from "../server/session";

export const prerender = false;

/** The raw tables, as stored. */
export const GET: APIRoute = async ({ cookies }) => {
  if (!isOwner(cookies)) return new Response("Sign in first", { status: 401 });
  const snapshot = await loadSnapshot(db);
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), ...snapshot }, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="routine-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
};

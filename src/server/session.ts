import { createHmac, timingSafeEqual } from "node:crypto";
import type { APIContext } from "astro";
import { ActionError } from "astro:actions";
import { ROUTINE_PASSPHRASE, SESSION_SECRET } from "astro:env/server";

const SESSION_COOKIE = "routine_session";
/** Readable by the client so the UI knows which mode to render; carries no authority. */
const OWNER_COOKIE = "routine_owner";
const ONE_YEAR_S = 365 * 24 * 60 * 60;

type Cookies = APIContext["cookies"];

function sign(payload: string): string {
  return createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function passphraseMatches(candidate: string): boolean {
  // Compare HMACs so lengths never leak.
  return safeEqual(sign(candidate), sign(ROUTINE_PASSPHRASE));
}

export function isOwner(cookies: Cookies): boolean {
  const value = cookies.get(SESSION_COOKIE)?.value;
  if (!value) return false;
  const dot = value.indexOf(".");
  if (dot < 0) return false;
  const exp = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  return Number(exp) > Date.now() && safeEqual(sign(exp), sig);
}

export function startSession(cookies: Cookies): void {
  const exp = String(Date.now() + ONE_YEAR_S * 1000);
  const opts = { path: "/", maxAge: ONE_YEAR_S, sameSite: "lax" as const, secure: import.meta.env.PROD };
  cookies.set(SESSION_COOKIE, `${exp}.${sign(exp)}`, { ...opts, httpOnly: true });
  cookies.set(OWNER_COOKIE, "1", opts);
}

export function endSession(cookies: Cookies): void {
  cookies.delete(SESSION_COOKIE, { path: "/" });
  cookies.delete(OWNER_COOKIE, { path: "/" });
}

export function requireOwner(cookies: Cookies): void {
  if (!isOwner(cookies)) throw new ActionError({ code: "UNAUTHORIZED", message: "Sign in to make changes" });
}

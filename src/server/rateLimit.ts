import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { loginAttempts } from "../db/schema";

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

/** True when this IP may attempt a login right now. */
export async function loginAllowed(db: Db, ip: string): Promise<boolean> {
  const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.ip, ip));
  if (!row) return true;
  if (Date.now() - Date.parse(row.windowStart) > WINDOW_MS) return true;
  return row.count < MAX_ATTEMPTS;
}

export async function recordLoginFailure(db: Db, ip: string): Promise<void> {
  const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.ip, ip));
  const expired = !row || Date.now() - Date.parse(row.windowStart) > WINDOW_MS;
  const next = { ip, count: expired ? 1 : row.count + 1, windowStart: expired ? new Date().toISOString() : row.windowStart };
  await db.insert(loginAttempts).values(next).onConflictDoUpdate({ target: loginAttempts.ip, set: next });
}

export async function clearLoginFailures(db: Db, ip: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.ip, ip));
}

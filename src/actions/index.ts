import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { and, eq, max } from "drizzle-orm";
import { db } from "../db";
import { loadSnapshot } from "../db/load";
import { events, pauses, routines, schedules, settings } from "../db/schema";
import { addDays, BACKFILL_DAYS, diffDays, Index, skipsLeft } from "../engine";
import { clearLoginFailures, loginAllowed, recordLoginFailure } from "../server/rateLimit";
import { endSession, passphraseMatches, requireOwner, startSession } from "../server/session";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const isoTime = z.iso.datetime();
const id = z.string().min(1).max(64);
const importance = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const cadence = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("daily") }),
  z.object({ kind: z.literal("weekly"), timesPerWeek: z.number().int().min(1).max(6) }),
]);

async function routineOrThrow(routineId: string) {
  const [routine] = await db.select().from(routines).where(eq(routines.id, routineId));
  if (!routine) throw new ActionError({ code: "NOT_FOUND", message: "No such routine" });
  return routine;
}

export const server = {
  login: defineAction({
    input: z.object({ passphrase: z.string().min(1).max(512) }),
    handler: async ({ passphrase }, { cookies, clientAddress }) => {
      const ip = clientAddress || "unknown";
      if (!(await loginAllowed(db, ip))) {
        throw new ActionError({ code: "TOO_MANY_REQUESTS", message: "Too many attempts. Try again in 15 minutes." });
      }
      if (!passphraseMatches(passphrase)) {
        await recordLoginFailure(db, ip);
        throw new ActionError({ code: "UNAUTHORIZED", message: "That's not it" });
      }
      await clearLoginFailures(db, ip);
      startSession(cookies);
      return { ok: true };
    },
  }),

  logout: defineAction({
    handler: async (_, { cookies }) => {
      endSession(cookies);
      return { ok: true };
    },
  }),

  /**
   * Append a check-in event. Idempotent on `id`, so the offline outbox can
   * retry freely. The backfill window is checked against the device's own
   * `loggedAt`, with a day of slack for time zones.
   */
  logEvent: defineAction({
    input: z.object({
      id,
      routineId: id,
      forDate: isoDate,
      kind: z.enum(["done", "undone", "skip", "unskip"]),
      loggedAt: isoTime,
      note: z.string().max(200).nullish(),
    }),
    handler: async (input, { cookies }) => {
      requireOwner(cookies);
      const routine = await routineOrThrow(input.routineId);
      if (routine.archivedOn && input.forDate >= routine.archivedOn) {
        throw new ActionError({ code: "CONFLICT", message: "Routine is archived" });
      }
      if (input.forDate < routine.createdOn) {
        throw new ActionError({ code: "BAD_REQUEST", message: "Before the routine existed" });
      }
      const lag = diffDays(input.forDate, input.loggedAt.slice(0, 10));
      if (lag < -1 || lag > BACKFILL_DAYS + 1) {
        throw new ActionError({ code: "BAD_REQUEST", message: `Only the last ${BACKFILL_DAYS} days can be changed` });
      }
      if (input.kind === "skip") {
        const idx = new Index(await loadSnapshot(db));
        if (idx.mark(routine.id, input.forDate) !== "skipped" && skipsLeft(idx, routine.id, input.forDate) === 0) {
          throw new ActionError({ code: "CONFLICT", message: "No skips left this month" });
        }
      }
      await db
        .insert(events)
        .values({ ...input, note: input.note ?? null })
        .onConflictDoNothing();
      return { ok: true };
    },
  }),

  createRoutine: defineAction({
    input: z.object({
      id,
      name: z.string().trim().min(1).max(60),
      emoji: z.string().min(1).max(16),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      importance,
      cadence,
      today: isoDate,
    }),
    handler: async ({ cadence, today, ...input }, { cookies }) => {
      requireOwner(cookies);
      const [row] = await db.select({ top: max(routines.sortOrder) }).from(routines);
      await db.insert(routines).values({ ...input, sortOrder: (row?.top ?? -1) + 1, createdOn: today, archivedOn: null });
      await db.insert(schedules).values({
        id: crypto.randomUUID(),
        routineId: input.id,
        cadence: cadence.kind,
        timesPerWeek: cadence.kind === "weekly" ? cadence.timesPerWeek : null,
        effectiveFrom: today,
      });
      return { ok: true };
    },
  }),

  updateRoutine: defineAction({
    input: z.object({
      id,
      name: z.string().trim().min(1).max(60).optional(),
      emoji: z.string().min(1).max(16).optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      importance: importance.optional(),
    }),
    handler: async ({ id: routineId, ...patch }, { cookies }) => {
      requireOwner(cookies);
      await routineOrThrow(routineId);
      await db.update(routines).set(patch).where(eq(routines.id, routineId));
      return { ok: true };
    },
  }),

  /** New cadence from `effectiveFrom` (the device's today); history keeps the old one. */
  changeCadence: defineAction({
    input: z.object({ routineId: id, cadence, effectiveFrom: isoDate }),
    handler: async ({ routineId, cadence, effectiveFrom }, { cookies }) => {
      requireOwner(cookies);
      const routine = await routineOrThrow(routineId);
      const from = effectiveFrom < routine.createdOn ? routine.createdOn : effectiveFrom;
      // Replace a schedule already starting on the same day rather than stacking two.
      await db.delete(schedules).where(and(eq(schedules.routineId, routineId), eq(schedules.effectiveFrom, from)));
      await db.insert(schedules).values({
        id: crypto.randomUUID(),
        routineId,
        cadence: cadence.kind,
        timesPerWeek: cadence.kind === "weekly" ? cadence.timesPerWeek : null,
        effectiveFrom: from,
      });
      return { ok: true };
    },
  }),

  reorderRoutines: defineAction({
    input: z.object({ ids: z.array(id).min(1) }),
    handler: async ({ ids }, { cookies }) => {
      requireOwner(cookies);
      await Promise.all(ids.map((rid, i) => db.update(routines).set({ sortOrder: i }).where(eq(routines.id, rid))));
      return { ok: true };
    },
  }),

  archiveRoutine: defineAction({
    input: z.object({ id, on: isoDate }),
    handler: async ({ id: routineId, on }, { cookies }) => {
      requireOwner(cookies);
      await routineOrThrow(routineId);
      await db.update(routines).set({ archivedOn: on }).where(eq(routines.id, routineId));
      return { ok: true };
    },
  }),

  /** Only for mistakes: a routine created within a day that has no check-ins. */
  deleteRoutine: defineAction({
    input: z.object({ id, today: isoDate }),
    handler: async ({ id: routineId, today }, { cookies }) => {
      requireOwner(cookies);
      const routine = await routineOrThrow(routineId);
      const [existing] = await db.select({ id: events.id }).from(events).where(eq(events.routineId, routineId)).limit(1);
      if (existing || diffDays(routine.createdOn, today) > 1) {
        throw new ActionError({ code: "CONFLICT", message: "Archive instead: this routine has history" });
      }
      await db.delete(schedules).where(eq(schedules.routineId, routineId));
      await db.delete(pauses).where(eq(pauses.routineId, routineId));
      await db.delete(routines).where(eq(routines.id, routineId));
      return { ok: true };
    },
  }),

  /** `routineId: null` pauses everything. Start may be back-dated within the backfill window. */
  pause: defineAction({
    input: z.object({
      id,
      routineId: id.nullable(),
      startDate: isoDate,
      endDate: isoDate.nullable(),
      note: z.string().max(200).nullish(),
      today: isoDate,
    }),
    handler: async ({ today, ...input }, { cookies }) => {
      requireOwner(cookies);
      if (input.routineId) await routineOrThrow(input.routineId);
      if (diffDays(input.startDate, today) > BACKFILL_DAYS) {
        throw new ActionError({ code: "BAD_REQUEST", message: `Pauses can start at most ${BACKFILL_DAYS} days ago` });
      }
      if (input.endDate && input.endDate < input.startDate) {
        throw new ActionError({ code: "BAD_REQUEST", message: "Pause ends before it starts" });
      }
      await db.insert(pauses).values({ ...input, note: input.note ?? null }).onConflictDoNothing();
      return { ok: true };
    },
  }),

  /** Resuming on `on` makes that day due again; a pause resumed on its start day disappears. */
  resume: defineAction({
    input: z.object({ id, on: isoDate }),
    handler: async ({ id: pauseId, on }, { cookies }) => {
      requireOwner(cookies);
      const [pause] = await db.select().from(pauses).where(eq(pauses.id, pauseId));
      if (!pause) throw new ActionError({ code: "NOT_FOUND", message: "No such pause" });
      if (on <= pause.startDate) await db.delete(pauses).where(eq(pauses.id, pauseId));
      else await db.update(pauses).set({ endDate: addDays(on, -1) }).where(eq(pauses.id, pauseId));
      return { ok: true };
    },
  }),

  updateSettings: defineAction({
    input: z.object({ dayCutoffHour: z.number().int().min(0).max(12) }),
    handler: async (patch, { cookies }) => {
      requireOwner(cookies);
      await db
        .insert(settings)
        .values({ id: 1, ...patch })
        .onConflictDoUpdate({ target: settings.id, set: patch });
      return { ok: true };
    },
  }),
};

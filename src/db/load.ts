import { DEFAULT_CUTOFF_HOUR, type Cadence, type Importance, type Snapshot } from "../engine";
import type { Db } from "./client";
import { events, pauses, routines, schedules, settings } from "./schema";

export async function loadSnapshot(db: Db): Promise<Snapshot> {
  const [r, s, e, p, st] = await Promise.all([
    db.select().from(routines),
    db.select().from(schedules),
    db.select().from(events),
    db.select().from(pauses),
    db.select().from(settings),
  ]);
  return {
    routines: r.map((row) => ({ ...row, importance: row.importance as Importance })),
    schedules: s.map((row) => ({
      routineId: row.routineId,
      effectiveFrom: row.effectiveFrom,
      cadence: toCadence(row.cadence, row.timesPerWeek),
    })),
    events: e,
    pauses: p,
    settings: { dayCutoffHour: st[0]?.dayCutoffHour ?? DEFAULT_CUTOFF_HOUR },
  };
}

function toCadence(kind: "daily" | "weekly", timesPerWeek: number | null): Cadence {
  return kind === "daily" ? { kind } : { kind, timesPerWeek: timesPerWeek ?? 1 };
}

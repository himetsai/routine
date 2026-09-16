import type { ISODate } from "./dates";
import { Index } from "./snapshot";
import type { Cadence, Importance, Pause, Routine, RoutineEvent, Schedule, Snapshot } from "./types";

/** Test-only helpers for building snapshots tersely. */

export interface RoutineSpec {
  id: string;
  cadence: Cadence;
  importance?: Importance;
  createdOn: ISODate;
  archivedOn?: ISODate | null;
  /** Later schedules: `[effectiveFrom, cadence]`. */
  changes?: [ISODate, Cadence][];
}

export type MarkSpec = [routineId: string, date: ISODate, kind: RoutineEvent["kind"]];

export function build(opts: {
  routines: RoutineSpec[];
  marks?: MarkSpec[];
  pauses?: Partial<Pause>[];
  cutoff?: number;
}): Index {
  const routines: Routine[] = opts.routines.map((r, i) => ({
    id: r.id,
    name: r.id,
    emoji: "•",
    color: "#ff7777",
    importance: r.importance ?? 2,
    sortOrder: i,
    createdOn: r.createdOn,
    archivedOn: r.archivedOn ?? null,
  }));
  const schedules: Schedule[] = opts.routines.flatMap((r) => [
    { routineId: r.id, cadence: r.cadence, effectiveFrom: r.createdOn },
    ...(r.changes ?? []).map(([effectiveFrom, cadence]) => ({ routineId: r.id, cadence, effectiveFrom })),
  ]);
  // Marks are applied in order; each later event is logged one second after the previous.
  const events: RoutineEvent[] = (opts.marks ?? []).map(([routineId, forDate, kind], i) => ({
    id: `e${i}`,
    routineId,
    forDate,
    kind,
    loggedAt: new Date(Date.UTC(2030, 0, 1, 0, 0, i)).toISOString(),
    note: null,
  }));
  const pauses: Pause[] = (opts.pauses ?? []).map((p, i) => ({
    id: `p${i}`,
    routineId: p.routineId ?? null,
    startDate: p.startDate!,
    endDate: p.endDate ?? null,
    note: null,
  }));
  const snap: Snapshot = { routines, schedules, events, pauses, settings: { dayCutoffHour: opts.cutoff ?? 4 } };
  return new Index(snap);
}

export const daily: Cadence = { kind: "daily" };
export const weekly = (n: number): Cadence => ({ kind: "weekly", timesPerWeek: n });

/** Every day in [from, to] marked done for a routine. */
export function doneRange(routineId: string, from: ISODate, to: ISODate): MarkSpec[] {
  const out: MarkSpec[] = [];
  const [y, m, d] = from.split("-").map(Number) as [number, number, number];
  for (let t = Date.UTC(y, m - 1, d); ; t += 86_400_000) {
    const dt = new Date(t);
    const iso = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
    if (iso > to) break;
    out.push([routineId, iso, "done"]);
  }
  return out;
}

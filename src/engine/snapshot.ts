import { maxDate, weekStart, type ISODate } from "./dates";
import type { Cadence, Pause, Routine, Schedule, Snapshot } from "./types";

export type Mark = "done" | "skipped";

/**
 * An indexed, read-only view of a Snapshot. Everything the engine derives is
 * computed from this; nothing here is stored.
 */
export class Index {
  readonly routines: Routine[];
  readonly settings: Snapshot["settings"];
  private readonly byId = new Map<string, Routine>();
  private readonly schedules = new Map<string, Schedule[]>();
  private readonly marks = new Map<string, Mark>();
  private readonly eventCount = new Map<string, number>();
  private readonly pauses: Pause[];

  constructor(snap: Snapshot) {
    this.routines = [...snap.routines].sort((a, b) => a.sortOrder - b.sortOrder);
    this.settings = snap.settings;
    this.pauses = snap.pauses;
    for (const r of snap.routines) this.byId.set(r.id, r);
    for (const s of snap.schedules) {
      const list = this.schedules.get(s.routineId) ?? [];
      list.push(s);
      this.schedules.set(s.routineId, list);
    }
    for (const list of this.schedules.values()) {
      list.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    }
    // Latest event per (routine, day) wins. Events arrive in any order.
    const ordered = [...snap.events].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
    for (const e of ordered) {
      this.eventCount.set(e.routineId, (this.eventCount.get(e.routineId) ?? 0) + 1);
      const key = `${e.routineId}|${e.forDate}`;
      if (e.kind === "done") this.marks.set(key, "done");
      else if (e.kind === "skip") this.marks.set(key, "skipped");
      else this.marks.delete(key);
    }
  }

  routine(id: string): Routine | undefined {
    return this.byId.get(id);
  }

  mark(routineId: string, date: ISODate): Mark | null {
    return this.marks.get(`${routineId}|${date}`) ?? null;
  }

  /** The routine exists on this day (created, not yet archived). */
  exists(routine: Routine, date: ISODate): boolean {
    return date >= routine.createdOn && (routine.archivedOn === null || date < routine.archivedOn);
  }

  /** The pause covering this routine on `date` (a global one counts), if any. */
  pauseFor(routineId: string, date: ISODate): Pause | null {
    return (
      this.pauses.find(
        (p) =>
          (p.routineId === null || p.routineId === routineId) &&
          p.startDate <= date &&
          (p.endDate === null || date <= p.endDate),
      ) ?? null
    );
  }

  isPaused(routineId: string, date: ISODate): boolean {
    return this.pauseFor(routineId, date) !== null;
  }

  /** The global pause in effect on `date`, if any. */
  globalPause(date: ISODate): Pause | null {
    return this.pauses.find((p) => p.routineId === null && p.startDate <= date && (p.endDate === null || date <= p.endDate)) ?? null;
  }

  hasEvents(routineId: string): boolean {
    return this.eventCount.get(routineId) !== undefined;
  }

  /** Exists and not paused: a day that can be due. */
  isActive(routine: Routine, date: ISODate): boolean {
    return this.exists(routine, date) && !this.isPaused(routine.id, date);
  }

  /**
   * The cadence governing `date`. A week is graded by one cadence: the schedule
   * in effect on the week's first day the routine existed. Cadence changes made
   * mid-week therefore take effect the following Monday.
   */
  cadenceFor(routine: Routine, date: ISODate): Cadence | null {
    const anchor = maxDate(weekStart(date), routine.createdOn);
    let found: Schedule | null = null;
    for (const s of this.schedules.get(routine.id) ?? []) {
      if (s.effectiveFrom <= anchor) found = s;
      else break;
    }
    return found?.cadence ?? null;
  }
}

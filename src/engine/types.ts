import type { ISODate } from "./dates";

/** light = 1, medium = 2, high = 3 */
export type Importance = 1 | 2 | 3;

export type Cadence = { kind: "daily" } | { kind: "weekly"; timesPerWeek: number };

export interface Routine {
  id: string;
  name: string;
  emoji: string;
  color: string;
  importance: Importance;
  sortOrder: number;
  /** First day the routine exists; never due before this. */
  createdOn: ISODate;
  /** Set when archived; the routine is not due on or after this day. */
  archivedOn: ISODate | null;
}

/** A routine's cadence from `effectiveFrom` until a later schedule replaces it. */
export interface Schedule {
  routineId: string;
  cadence: Cadence;
  effectiveFrom: ISODate;
}

export type EventKind = "done" | "undone" | "skip" | "unskip";

/** Append-only. The latest event for a (routine, day) decides its mark. */
export interface RoutineEvent {
  id: string;
  routineId: string;
  forDate: ISODate;
  kind: EventKind;
  /** ISO timestamp (UTC) of when the event was logged on the device. */
  loggedAt: string;
  note: string | null;
}

export interface Pause {
  id: string;
  /** `null` pauses every routine. */
  routineId: string | null;
  startDate: ISODate;
  /** `null` = until resumed. */
  endDate: ISODate | null;
  note: string | null;
}

export interface Settings {
  dayCutoffHour: number;
}

export interface Snapshot {
  routines: Routine[];
  schedules: Schedule[];
  events: RoutineEvent[];
  pauses: Pause[];
  settings: Settings;
}

export const IMPORTANCE_LABEL: Record<Importance, string> = { 1: "light", 2: "medium", 3: "high" };
export const SKIPS_PER_MONTH = 2;
export const BACKFILL_DAYS = 7;
export const DEFAULT_CUTOFF_HOUR = 4;

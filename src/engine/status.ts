import { addDays, eachDay, minDate, weekEnd as weekEndOf, type ISODate } from "./dates";
import type { Index } from "./snapshot";
import type { Routine } from "./types";

/**
 * What a single day means for a routine.
 * - `none`: a weekly routine with nothing expected on this particular day
 * - `pending`: today, not yet done
 */
export type DayStatus =
  | "inactive"
  | "paused"
  | "done"
  | "skipped"
  | "pending"
  | "missed"
  | "future"
  | "none";

export function dayStatus(idx: Index, routine: Routine, date: ISODate, today: ISODate): DayStatus {
  if (!idx.exists(routine, date)) return "inactive";
  const cadence = idx.cadenceFor(routine, date);
  if (!cadence) return "inactive";
  // A mark beats a pause: if you did it while paused, it still counts.
  const mark = idx.mark(routine.id, date);
  if (mark) return mark;
  if (idx.isPaused(routine.id, date)) return "paused";
  if (cadence.kind === "weekly") return "none";
  if (date > today) return "future";
  return date === today ? "pending" : "missed";
}

export type WeekState =
  | "inactive" // routine did not exist this week
  | "excluded" // paused enough that the prorated target is 0
  | "met"
  | "failed"
  | "future"
  | "on-track"
  | "at-risk" // must do every remaining day
  | "impossible"; // fewer days left than sessions needed — fails early

export interface WeekEval {
  weekStart: ISODate;
  state: WeekState;
  /** Sessions still required this week after proration and skips. */
  target: number;
  done: number;
  skips: number;
  /** Days this week the routine existed and was not paused. */
  activeDays: number;
  /** Unmarked active days from today to Sunday (current week only). */
  remaining: number;
}

/**
 * Evaluate one week of a weekly (N×/week) routine.
 * Proration: `round(N × activeDays / 7)`; a skip lowers the target by one.
 */
export function weeklyEval(idx: Index, routine: Routine, weekStart: ISODate, today: ISODate): WeekEval {
  const weekEnd = weekEndOf(weekStart);
  const cadence = idx.cadenceFor(routine, weekStart);
  const base: WeekEval = { weekStart, state: "inactive", target: 0, done: 0, skips: 0, activeDays: 0, remaining: 0 };
  if (!cadence || cadence.kind !== "weekly") return base;

  let existed = false;
  for (const d of eachDay(weekStart, weekEnd)) {
    if (!idx.exists(routine, d)) continue;
    existed = true;
    if (idx.isActive(routine, d)) base.activeDays++;
    const mark = idx.mark(routine.id, d);
    if (mark === "done") base.done++;
    else if (mark === "skipped") base.skips++;
    if (d >= today && d <= weekEnd && idx.isActive(routine, d) && !mark) base.remaining++;
  }
  if (!existed) return base;

  const prorated = base.activeDays === 7 ? cadence.timesPerWeek : Math.round((cadence.timesPerWeek * base.activeDays) / 7);
  if (prorated === 0) return { ...base, state: "excluded" };
  base.target = Math.max(0, prorated - base.skips);

  if (base.done >= base.target) return { ...base, state: "met" };
  if (weekEnd < today) return { ...base, state: "failed" };
  if (weekStart > today) return { ...base, state: "future" };
  const needed = base.target - base.done;
  if (needed > base.remaining) return { ...base, state: "impossible" };
  return { ...base, state: needed === base.remaining ? "at-risk" : "on-track" };
}

export interface DailyWeekEval {
  weekStart: ISODate;
  /** Active, unskipped days counted so far (through today for the current week). */
  due: number;
  done: number;
  skips: number;
  /** Days this week the routine existed. */
  existedDays: number;
}

/** One week of a daily routine, for grading. */
export function dailyWeekEval(idx: Index, routine: Routine, weekStart: ISODate, today: ISODate): DailyWeekEval {
  const through = minDate(weekEndOf(weekStart), today);
  const out: DailyWeekEval = { weekStart, due: 0, done: 0, skips: 0, existedDays: 0 };
  const cadence = idx.cadenceFor(routine, weekStart);
  if (!cadence || cadence.kind !== "daily") return out;
  for (let d = weekStart; d <= through; d = addDays(d, 1)) {
    if (!idx.exists(routine, d)) continue;
    out.existedDays++;
    const mark = idx.mark(routine.id, d);
    if (mark === "done") {
      out.done++;
      out.due++;
    } else if (mark === "skipped") out.skips++;
    else if (idx.isActive(routine, d)) out.due++;
  }
  return out;
}

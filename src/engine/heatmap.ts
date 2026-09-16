import { addDays, eachDay, weekStart as weekStartOf, type ISODate } from "./dates";
import { weekReport } from "./grade";
import type { Index } from "./snapshot";
import { dayStatus, weeklyEval, type DayStatus, type WeekEval } from "./status";
import type { Routine } from "./types";

export interface DayItem {
  routine: Routine;
  status: DayStatus;
}

export interface DayReport {
  date: ISODate;
  /** Daily routines that exist today, in display order (paused ones included). */
  daily: DayItem[];
  /** Weekly routines that exist today, with this week's progress. */
  weekly: { routine: Routine; eval: WeekEval }[];
  /** Daily routines due (active, not skipped) and how many are done. */
  due: number;
  done: number;
  perfect: boolean;
  /** 0–4 intensity for the overall heatmap; `null` when nothing was active. */
  level: number | null;
}

export function dayReport(idx: Index, date: ISODate, today: ISODate): DayReport {
  const daily: DayItem[] = [];
  const weekly: DayReport["weekly"] = [];
  let due = 0;
  let done = 0;
  let doneWeight = 0;
  let possibleWeight = 0;

  for (const routine of idx.routines) {
    if (!idx.exists(routine, date)) continue;
    const cadence = idx.cadenceFor(routine, date);
    if (!cadence) continue;
    const status = dayStatus(idx, routine, date, today);
    if (idx.isActive(routine, date) || status === "done") possibleWeight += routine.importance;
    if (status === "done") doneWeight += routine.importance;

    if (cadence.kind === "daily") {
      daily.push({ routine, status });
      if (status === "done") {
        due++;
        done++;
      } else if (status === "pending" || status === "missed") due++;
    } else {
      weekly.push({ routine, eval: weeklyEval(idx, routine, weekStartOf(date), today) });
    }
  }

  const level =
    possibleWeight === 0 ? null : doneWeight === 0 ? 0 : Math.ceil((4 * doneWeight) / possibleWeight);
  return { date, daily, weekly, due, done, perfect: due > 0 && done === due, level };
}

export interface HeatmapCell {
  date: ISODate;
  level: number | null;
  report: DayReport;
}

export interface Heatmap {
  /** Monday `weeks` weeks back through `today`, inclusive. */
  cells: HeatmapCell[];
  perfectDays: number;
  perfectWeeks: number;
}

/** GitHub-style rolling window: the last `weeks` full weeks plus the current one. */
export function overallHeatmap(idx: Index, today: ISODate, weeks = 52): Heatmap {
  const start = addDays(weekStartOf(today), -7 * (weeks - 1));
  const cells: HeatmapCell[] = [];
  let perfectDays = 0;
  for (const date of eachDay(start, today)) {
    const report = dayReport(idx, date, today);
    if (report.perfect) perfectDays++;
    cells.push({ date, level: report.level, report });
  }
  let perfectWeeks = 0;
  for (let ws = start; ws <= today; ws = addDays(ws, 7)) {
    if (weekReport(idx, ws, today).perfect) perfectWeeks++;
  }
  return { cells, perfectDays, perfectWeeks };
}

export interface RoutineCell {
  date: ISODate;
  status: DayStatus;
}

export function routineHeatmap(idx: Index, routine: Routine, today: ISODate, weeks = 52): RoutineCell[] {
  const start = addDays(weekStartOf(today), -7 * (weeks - 1));
  return eachDay(start, today).map((date) => ({ date, status: dayStatus(idx, routine, date, today) }));
}

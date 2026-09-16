import { addDays, weekEnd as weekEndOf, weekStart as weekStartOf, type ISODate } from "./dates";
import type { Index } from "./snapshot";
import { dailyWeekEval, weeklyEval, type DailyWeekEval, type WeekEval } from "./status";
import type { Routine } from "./types";

export type Letter = "A+" | "A" | "B" | "C" | "D" | "F";

export function letterFor(score: number): Letter {
  if (score >= 100) return "A+";
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export type RoutineWeekGrade =
  | { routine: Routine; kind: "weekly"; ratio: number | null; eval: WeekEval }
  | { routine: Routine; kind: "daily"; ratio: number | null; eval: DailyWeekEval };

export interface WeekReport {
  weekStart: ISODate;
  weekEnd: ISODate;
  /** The week is over; the letter is final. */
  final: boolean;
  /** 0–100, importance-weighted mean of per-routine ratios. `null` if nothing was gradable. */
  score: number | null;
  letter: Letter | null;
  perfect: boolean;
  routines: RoutineWeekGrade[];
}

/**
 * Grade one week. Each routine contributes `done / target` (capped at 1),
 * weighted by importance — so a missed weekly high-importance post costs
 * more than a missed daily light-importance floss, regardless of frequency.
 */
export function weekReport(idx: Index, date: ISODate, today: ISODate): WeekReport {
  const weekStart = weekStartOf(date);
  const weekEnd = weekEndOf(weekStart);
  const final = weekEnd < today;
  const routines: RoutineWeekGrade[] = [];

  for (const routine of idx.routines) {
    const cadence = idx.cadenceFor(routine, weekStart);
    if (!cadence) continue;
    if (cadence.kind === "weekly") {
      const ev = weeklyEval(idx, routine, weekStart, today);
      const gradable = !["inactive", "excluded", "future"].includes(ev.state);
      const ratio = !gradable ? null : ev.target === 0 ? 1 : Math.min(1, ev.done / ev.target);
      routines.push({ routine, kind: "weekly", ratio, eval: ev });
    } else {
      const ev = dailyWeekEval(idx, routine, weekStart, today);
      const ratio = ev.existedDays === 0 ? null : ev.due === 0 ? (ev.skips > 0 ? 1 : null) : ev.done / ev.due;
      routines.push({ routine, kind: "daily", ratio, eval: ev });
    }
  }

  let weight = 0;
  let sum = 0;
  for (const g of routines) {
    if (g.ratio === null) continue;
    weight += g.routine.importance;
    sum += g.routine.importance * g.ratio;
  }
  const score = weight === 0 ? null : Math.round((sum / weight) * 100);
  return {
    weekStart,
    weekEnd,
    final,
    score,
    letter: score === null ? null : letterFor(score),
    perfect: final && score === 100,
    routines,
  };
}

/** Mean score of the last `weeks` completed weeks (skipping ungradable ones). */
export function trend(idx: Index, today: ISODate, weeks = 4): number | null {
  const scores: number[] = [];
  let ws = addDays(weekStartOf(today), -7);
  for (let i = 0; i < weeks; i++, ws = addDays(ws, -7)) {
    const s = weekReport(idx, ws, today).score;
    if (s !== null) scores.push(s);
  }
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

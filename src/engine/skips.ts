import { addDays, monthKey, type ISODate } from "./dates";
import type { Index } from "./snapshot";
import { SKIPS_PER_MONTH } from "./types";

/** Skips a routine has used in the calendar month containing `date`. */
export function skipsUsed(idx: Index, routineId: string, date: ISODate): number {
  const month = monthKey(date);
  let used = 0;
  for (let d = `${month}-01`; monthKey(d) === month; d = addDays(d, 1)) {
    if (idx.mark(routineId, d) === "skipped") used++;
  }
  return used;
}

export function skipsLeft(idx: Index, routineId: string, date: ISODate): number {
  return Math.max(0, SKIPS_PER_MONTH - skipsUsed(idx, routineId, date));
}

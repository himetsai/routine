/** A local calendar date as `YYYY-MM-DD`. Compares correctly as a string. */
export type ISODate = string;

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");

function toUTC(date: ISODate): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): ISODate {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(date: ISODate, n: number): ISODate {
  return fromUTC(toUTC(date) + n * DAY_MS);
}

/** Days from `a` to `b` (positive when `b` is later). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday. */
export function dayOfWeek(date: ISODate): number {
  return (new Date(toUTC(date)).getUTCDay() + 6) % 7;
}

export function weekStart(date: ISODate): ISODate {
  return addDays(date, -dayOfWeek(date));
}

export function weekEnd(date: ISODate): ISODate {
  return addDays(weekStart(date), 6);
}

export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function monthKey(date: ISODate): string {
  return date.slice(0, 7);
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}

export function localDate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The routine-day that `now` belongs to. Anything before `cutoffHour` in the
 * morning still counts as the previous day, so a 1 am chapter is "today".
 */
export function todayFor(now: Date, cutoffHour: number): ISODate {
  return localDate(new Date(now.getTime() - cutoffHour * 3_600_000));
}

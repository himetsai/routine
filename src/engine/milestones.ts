import type { Streak } from "./streaks";

export const MILESTONES = {
  days: [7, 30, 100, 365],
  weeks: [4, 12, 26, 52],
} as const;

/** The milestone a streak sits on exactly, or `null`. */
export function milestoneReached(streak: Pick<Streak, "unit" | "current">): number | null {
  return (MILESTONES[streak.unit] as readonly number[]).includes(streak.current) ? streak.current : null;
}

/** The next milestone ahead of the current streak, or `null` past the last one. */
export function nextMilestone(streak: Pick<Streak, "unit" | "current">): number | null {
  return (MILESTONES[streak.unit] as readonly number[]).find((m) => m > streak.current) ?? null;
}

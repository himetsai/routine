import { addDays, weekStart as weekStartOf, type ISODate } from "./dates";
import type { Index } from "./snapshot";
import { dayStatus, weeklyEval } from "./status";
import type { Routine } from "./types";

export interface Streak {
  unit: "days" | "weeks";
  current: number;
  best: number;
  /** The current period is not yet done but hasn't failed either. */
  open: boolean;
}

/**
 * Streak rules: `done` extends; `skipped`/`paused`/`excluded` bridge without
 * extending; `missed`/`failed`/`impossible` break. Today (or this week) never
 * breaks a streak until it is over.
 */
export function streak(idx: Index, routine: Routine, today: ISODate): Streak {
  const cadence = idx.cadenceFor(routine, today);
  return cadence?.kind === "weekly" ? weeklyStreak(idx, routine, today) : dailyStreak(idx, routine, today);
}

type Step = "extend" | "bridge" | "break" | "stop";

function runStreak(steps: (i: number) => Step | "open"): Omit<Streak, "unit"> {
  // Walk backwards from the current period computing `current`; then forwards over
  // the same periods computing `best`. `steps(0)` is the current period.
  let current = 0;
  let open = false;
  for (let i = 0; ; i++) {
    const s = steps(i);
    if (s === "open") {
      open = true;
      continue;
    }
    if (s === "extend") current++;
    else if (s === "bridge") continue;
    else break;
  }
  let best = 0;
  let run = 0;
  for (let i = 0; ; i++) {
    const s = steps(i);
    if (s === "stop") break;
    if (s === "extend") run++;
    else if (s === "break") run = 0;
    best = Math.max(best, run);
  }
  return { current, best: Math.max(best, current), open };
}

function dailyStreak(idx: Index, routine: Routine, today: ISODate): Streak {
  const steps = (i: number): Step | "open" => {
    const date = addDays(today, -i);
    if (date < routine.createdOn) return "stop";
    switch (dayStatus(idx, routine, date, today)) {
      case "done":
        return "extend";
      case "pending":
        return "open";
      case "skipped":
      case "paused":
      case "none":
        return "bridge";
      case "missed":
        return "break";
      default:
        return "stop";
    }
  };
  return { unit: "days", ...runStreak(steps) };
}

function weeklyStreak(idx: Index, routine: Routine, today: ISODate): Streak {
  const thisWeek = weekStartOf(today);
  const steps = (i: number): Step | "open" => {
    const ws = addDays(thisWeek, -7 * i);
    if (addDays(ws, 6) < routine.createdOn) return "stop";
    switch (weeklyEval(idx, routine, ws, today).state) {
      case "met":
        return "extend";
      case "on-track":
      case "at-risk":
        return "open";
      case "excluded":
        return "bridge";
      case "failed":
      case "impossible":
        return "break";
      default:
        return "stop";
    }
  };
  return { unit: "weeks", ...runStreak(steps) };
}

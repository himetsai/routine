import { useEffect, useMemo, useRef } from "react";
import { dayOfWeek, dayReport, milestoneReached, streak, weekReport, type Index, type ISODate } from "../../engine";
import { celebrateMilestone, celebratePerfectDay, celebratePerfectWeek } from "../celebrate";
import { toast } from "./toast";

interface Watched {
  streaks: Record<string, number>;
  perfectDay: boolean;
  perfectWeek: boolean;
}

/**
 * Fires celebrations on *transitions* made in this session — never on load,
 * so opening the app on day 30 doesn't re-celebrate what already happened.
 */
export function useCelebrations(idx: Index | null, today: ISODate, enabled: boolean) {
  const prev = useRef<Watched | null>(null);

  const now = useMemo<Watched | null>(() => {
    if (!idx) return null;
    const streaks: Record<string, number> = {};
    for (const r of idx.routines) if (idx.exists(r, today)) streaks[r.id] = streak(idx, r, today).current;
    const week = weekReport(idx, today, today);
    return {
      streaks,
      perfectDay: dayReport(idx, today, today).perfect,
      // A provisional 100 only means "perfect week" once Sunday's last item lands.
      perfectWeek: dayOfWeek(today) === 6 && week.score === 100 && week.routines.every((g) => g.ratio === null || g.ratio >= 1),
    };
  }, [idx, today]);

  useEffect(() => {
    if (!now) return;
    const before = prev.current;
    prev.current = now;
    if (!before || !enabled || !idx) return;

    let celebrated = false;
    for (const r of idx.routines) {
      const cur = now.streaks[r.id] ?? 0;
      const old = before.streaks[r.id] ?? 0;
      const unit = idx.cadenceFor(r, today)?.kind === "weekly" ? "weeks" : "days";
      const hit = milestoneReached({ unit, current: cur });
      if (hit !== null && cur > old) {
        celebrateMilestone();
        toast(`${hit}-${unit === "days" ? "day" : "week"} streak · ${r.emoji} ${r.name}`, "info", { ms: 5000 });
        celebrated = true;
      }
    }
    if (now.perfectWeek && !before.perfectWeek) {
      celebratePerfectWeek();
      toast("Perfect week ♥", "info", { ms: 5000 });
    } else if (now.perfectDay && !before.perfectDay && !celebrated) {
      celebratePerfectDay();
    }
  }, [now, enabled, idx, today]);
}

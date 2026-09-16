import { useMemo } from "react";
import { nextMilestone, routineHeatmap, streak, type DayStatus, type Index, type ISODate, type Routine } from "../../engine";
import { Heatmap, shortDate, withAlpha, type HeatCell } from "./Heatmap";

interface Props {
  idx: Index;
  routine: Routine;
  today: ISODate;
  onOpen?: (routine: Routine) => void;
}

function fillFor(status: DayStatus, color: string): string {
  switch (status) {
    case "done":
      return color;
    case "skipped":
      return withAlpha(color, 0.3);
    case "paused":
      return "rgba(51,39,42,0.12)";
    case "missed":
      return "rgba(201,79,109,0.18)";
    default:
      return "rgba(51,39,42,0.05)";
  }
}

const STATUS_LABEL: Record<DayStatus, string> = {
  done: "done",
  skipped: "skipped",
  paused: "paused",
  missed: "missed",
  pending: "not yet",
  future: "",
  none: "rest day",
  inactive: "",
};

export function RoutineCard({ idx, routine, today, onOpen }: Props) {
  const s = useMemo(() => streak(idx, routine, today), [idx, routine, today]);
  const cadence = idx.cadenceFor(routine, today);
  const cells: HeatCell[] = useMemo(
    () =>
      routineHeatmap(idx, routine, today).map((c) => ({
        date: c.date,
        fill: fillFor(c.status, routine.color),
        label: `${shortDate(c.date)}\n${STATUS_LABEL[c.status] || "—"}`,
      })),
    [idx, routine, today],
  );
  const next = nextMilestone(s);
  const cadenceLabel = cadence?.kind === "weekly" ? `${cadence.timesPerWeek}×/week` : "daily";

  return (
    <section className="card p-5 sm:p-6">
      <header className="flex items-start justify-between gap-3">
        <button type="button" onClick={() => onOpen?.(routine)} className="min-w-0 text-left" disabled={!onOpen}>
          <h3 className="flex items-center gap-2 font-display text-lg font-bold">
            <span>{routine.emoji}</span>
            <span className="truncate">{routine.name}</span>
          </h3>
          <p className="mt-0.5 text-xs text-secondary/70">{cadenceLabel}</p>
        </button>
        <div className="shrink-0 text-right">
          <div className="font-display text-2xl font-bold tabular-nums" style={{ color: s.current > 0 ? routine.color : undefined }}>
            {s.current} <span className="text-sm">{s.unit === "days" ? (s.current === 1 ? "day" : "days") : s.current === 1 ? "week" : "weeks"}</span>
          </div>
          <div className="text-xs text-secondary/70">
            best {s.best}
            {next ? ` · ${next - s.current} to ${next}` : ""}
          </div>
        </div>
      </header>
      <div className="mt-3">
        <Heatmap cells={cells} size={9} />
      </div>
    </section>
  );
}

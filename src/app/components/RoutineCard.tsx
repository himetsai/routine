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
      return withAlpha(color, 0.35);
    case "paused":
      return "color-mix(in oklab, var(--color-fg) 12%, transparent)";
    case "missed":
      return "color-mix(in oklab, var(--color-bad) 22%, transparent)";
    default:
      return "var(--color-heat-0)";
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
  const unit = s.unit === "days" ? (s.current === 1 ? "day" : "days") : s.current === 1 ? "week" : "weeks";

  return (
    <section className="card p-4 sm:p-5">
      <header className="flex items-start justify-between gap-3">
        <button type="button" onClick={() => onOpen?.(routine)} className="min-w-0 text-left" disabled={!onOpen}>
          <h3 className="flex items-center gap-2 font-semibold tracking-tight">
            <span>{routine.emoji}</span>
            <span className="truncate">{routine.name}</span>
          </h3>
          <p className="mt-0.5 text-xs text-muted">{cadenceLabel}</p>
        </button>
        <div className="shrink-0 text-right">
          <div className="text-2xl font-semibold tabular-nums tracking-tight" style={{ color: s.current > 0 ? routine.color : undefined }}>
            {s.current} <span className="text-sm font-medium">{unit}</span>
          </div>
          <div className="text-xs text-muted">
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

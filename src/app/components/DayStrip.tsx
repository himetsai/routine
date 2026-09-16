import { addDays, BACKFILL_DAYS, dayStatus, type Index, type ISODate, type Routine } from "../../engine";
import { enqueue } from "../data/outbox";
import { haptic } from "../haptics";
import { withAlpha } from "./Heatmap";

interface Props {
  idx: Index;
  routine: Routine;
  today: ISODate;
}

/** The last week as tappable cells — the backfill window. */
export function DayStrip({ idx, routine, today }: Props) {
  const days = Array.from({ length: BACKFILL_DAYS }, (_, i) => addDays(today, i - (BACKFILL_DAYS - 1)));

  function toggle(date: ISODate) {
    const done = idx.mark(routine.id, date) === "done";
    enqueue({
      id: crypto.randomUUID(),
      routineId: routine.id,
      forDate: date,
      kind: done ? "undone" : "done",
      loggedAt: new Date().toISOString(),
      note: null,
    });
    haptic(done ? "uncheck" : "check");
  }

  return (
    <div className="flex justify-between gap-1">
      {days.map((date) => {
        const status = dayStatus(idx, routine, date, today);
        const done = status === "done";
        const dead = status === "inactive";
        const [, , d] = date.split("-");
        const weekday = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "narrow" });
        return (
          <button
            key={date}
            type="button"
            disabled={dead}
            onClick={() => toggle(date)}
            title={`${date} · ${status}`}
            className="flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-xs transition-colors hover:bg-fg/[0.03] disabled:opacity-30"
          >
            <span className="text-muted">{weekday}</span>
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] text-[11px] font-medium tabular-nums transition-colors ${
                done || status === "skipped" ? "" : status === "paused" ? "border-transparent bg-fg/10" : "border-border"
              }`}
              style={{
                borderColor: done || status === "skipped" ? routine.color : undefined,
                backgroundColor: done ? routine.color : status === "skipped" ? withAlpha(routine.color, 0.2) : undefined,
                color: done ? "white" : undefined,
              }}
            >
              {status === "skipped" ? "s" : Number(d)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

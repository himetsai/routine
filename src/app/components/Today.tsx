import { useState } from "react";
import { dayReport, dayStatus, type Index, type ISODate, type Routine } from "../../engine";
import { enqueue } from "../data/outbox";
import { haptic } from "../haptics";
import { RoutineRow } from "./RoutineRow";

interface Props {
  idx: Index;
  today: ISODate;
  owner: boolean;
  onOpen: (routine: Routine) => void;
  onCreate: () => void;
}

function formatDay(date: ISODate): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export function Today({ idx, today, owner, onOpen, onCreate }: Props) {
  const report = dayReport(idx, today, today);
  const [showPaused, setShowPaused] = useState(false);
  const active = report.daily.filter((d) => d.status !== "paused");
  const weeklyItems = report.weekly.map((w) => ({ ...w, status: dayStatus(idx, w.routine, today, today) }));
  const paused = [...report.daily.filter((d) => d.status === "paused"), ...weeklyItems.filter((w) => w.status === "paused")];
  const weekly = weeklyItems.filter((w) => w.status !== "paused");

  function toggle(routine: Routine, next: boolean) {
    enqueue({
      id: crypto.randomUUID(),
      routineId: routine.id,
      forDate: today,
      kind: next ? "done" : "undone",
      loggedAt: new Date().toISOString(),
      note: null,
    });
    haptic(next ? "check" : "uncheck");
  }

  const empty = active.length === 0 && weekly.length === 0 && paused.length === 0;
  const open = owner ? onOpen : undefined;

  return (
    <section className="card p-4 sm:p-5">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Today</h1>
          <div className="text-sm text-muted">{formatDay(today)}</div>
        </div>
        {report.due > 0 ? (
          <div className={`text-sm font-medium tabular-nums ${report.perfect ? "text-good" : "text-muted"}`}>
            {report.done}/{report.due}
            {report.perfect ? " · perfect day" : ""}
          </div>
        ) : null}
      </header>

      {empty ? (
        <p className="mt-4 text-sm text-muted">No routines yet.{owner ? " Add one to start a streak." : ""}</p>
      ) : (
        <ul className="mt-3">
          {active.map(({ routine, status }) => (
            <RoutineRow key={routine.id} routine={routine} status={status} owner={owner} onToggle={toggle} onOpen={open} />
          ))}
          {weekly.map(({ routine, eval: ev, status }) => (
            <RoutineRow key={routine.id} routine={routine} status={status} week={ev} owner={owner} onToggle={toggle} onOpen={open} />
          ))}
        </ul>
      )}

      {paused.length > 0 ? (
        <div className="mt-2 border-t border-border pt-2">
          <button type="button" onClick={() => setShowPaused((v) => !v)} className="link text-xs font-medium">
            {showPaused ? "▾" : "▸"} Paused ({paused.length})
          </button>
          {showPaused ? (
            <ul className="mt-1">
              {paused.map(({ routine, status }) => (
                <RoutineRow key={routine.id} routine={routine} status={status} owner={owner} onToggle={toggle} onOpen={open} />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {owner ? (
        <button
          type="button"
          onClick={onCreate}
          className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-fg/[0.03] hover:text-fg"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-border text-base leading-none">+</span>
          New routine
        </button>
      ) : null}
    </section>
  );
}

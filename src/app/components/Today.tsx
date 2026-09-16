import { useState } from "react";
import { dayReport, type Index, type ISODate, type Routine } from "../../engine";
import { enqueue } from "../data/outbox";
import { haptic } from "../haptics";
import { RoutineRow } from "./RoutineRow";

interface Props {
  idx: Index;
  today: ISODate;
  owner: boolean;
}

function formatDay(date: ISODate): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export function Today({ idx, today, owner }: Props) {
  const report = dayReport(idx, today, today);
  const [showPaused, setShowPaused] = useState(false);
  const active = report.daily.filter((d) => d.status !== "paused");
  const paused = [...report.daily.filter((d) => d.status === "paused"), ...report.weekly.filter((w) => w.eval.state === "excluded").map((w) => ({ routine: w.routine, status: "paused" as const }))];
  const weekly = report.weekly.filter((w) => w.eval.state !== "excluded");

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

  return (
    <section className="card p-5 sm:p-6">
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Today</h1>
        <div className="text-right">
          <div className="text-sm text-secondary">{formatDay(today)}</div>
          {report.due > 0 ? (
            <div className={`text-xs font-bold tabular-nums ${report.perfect ? "text-good" : "text-secondary/70"}`}>
              {report.done}/{report.due} done{report.perfect ? " · perfect day" : ""}
            </div>
          ) : null}
        </div>
      </header>

      {empty ? (
        <p className="mt-4 text-secondary">
          No routines yet.{owner ? " Add one below to start a streak." : ""}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-primary/5">
          {active.map(({ routine, status }) => (
            <RoutineRow key={routine.id} routine={routine} status={status} owner={owner} onToggle={toggle} />
          ))}
          {weekly.map(({ routine, eval: ev }) => (
            <RoutineRow
              key={routine.id}
              routine={routine}
              status={idx.mark(routine.id, today) ?? "none"}
              week={ev}
              owner={owner}
              onToggle={toggle}
            />
          ))}
        </ul>
      )}

      {paused.length > 0 ? (
        <div className="mt-3 border-t border-primary/5 pt-3">
          <button
            type="button"
            onClick={() => setShowPaused((v) => !v)}
            className="text-xs font-bold uppercase tracking-widest text-secondary/60 hover:text-secondary"
          >
            paused ({paused.length}) {showPaused ? "▾" : "▸"}
          </button>
          {showPaused ? (
            <ul className="mt-1 divide-y divide-primary/5">
              {paused.map(({ routine, status }) => (
                <RoutineRow key={routine.id} routine={routine} status={status} owner={owner} onToggle={toggle} />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

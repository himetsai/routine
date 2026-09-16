import { useMemo } from "react";
import { addDays, overallHeatmap, trend, weekReport, weekStart, type Index, type ISODate, type WeekReport } from "../../engine";
import { Heatmap, shortDate, withAlpha, type HeatCell } from "./Heatmap";

const CORAL = "#ff7777";
const LEVEL_FILL = ["rgba(51,39,42,0.06)", withAlpha(CORAL, 0.3), withAlpha(CORAL, 0.5), withAlpha(CORAL, 0.75), CORAL];

interface Props {
  idx: Index;
  today: ISODate;
}

export function Overview({ idx, today }: Props) {
  const thisWeek = useMemo(() => weekReport(idx, today, today), [idx, today]);
  const lastWeek = useMemo(() => weekReport(idx, addDays(weekStart(today), -7), today), [idx, today]);
  const avg = useMemo(() => trend(idx, today), [idx, today]);
  const heat = useMemo(() => overallHeatmap(idx, today), [idx, today]);

  const cells: HeatCell[] = heat.cells.map((c) => {
    const done = c.report.daily.filter((d) => d.status === "done").map((d) => d.routine.emoji);
    const weeklyDone = c.report.weekly.filter((w) => idx.mark(w.routine.id, c.date) === "done").map((w) => w.routine.emoji);
    const emojis = [...done, ...weeklyDone].join(" ");
    const detail = c.level === null ? "paused" : emojis ? emojis : "nothing done";
    return {
      date: c.date,
      fill: c.level === null ? "transparent" : LEVEL_FILL[c.level]!,
      star: c.report.perfect,
      label: `${shortDate(c.date)}\n${detail}${c.report.perfect ? " · perfect day" : ""}`,
    };
  });

  return (
    <>
      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <WeekHeadline report={thisWeek} />
          <dl className="flex gap-6 text-right">
            <Stat label="last week" value={lastWeek.letter ?? "–"} sub={lastWeek.score !== null ? `${lastWeek.score}` : undefined} />
            <Stat label="4-week avg" value={avg !== null ? `${avg}` : "–"} />
          </dl>
        </div>
        <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {thisWeek.routines.map((g) => (
            <li key={g.routine.id} className="flex items-center justify-between gap-3">
              <span className="truncate">
                <span className="mr-1.5">{g.routine.emoji}</span>
                {g.routine.name}
              </span>
              <span className="shrink-0 tabular-nums text-secondary">
                {g.kind === "weekly" ? `${g.eval.done}/${g.eval.target}` : `${g.eval.done}/${g.eval.due}`}
                {g.ratio !== null ? <span className="ml-2 inline-block w-12 text-right font-bold text-primary">{Math.round(g.ratio * 100)}%</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-bold">Last 52 weeks</h2>
          <p className="text-xs font-bold tabular-nums text-secondary/70">
            {heat.perfectDays} perfect {heat.perfectDays === 1 ? "day" : "days"} · {heat.perfectWeeks} perfect {heat.perfectWeeks === 1 ? "week" : "weeks"}
          </p>
        </div>
        <div className="mt-3">
          <Heatmap cells={cells} />
        </div>
      </section>
    </>
  );
}

function WeekHeadline({ report }: { report: WeekReport }) {
  const label = report.final ? "This week" : "This week so far";
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-widest text-secondary/60">{label}</div>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="font-display text-4xl font-bold tabular-nums text-primary">{report.score !== null ? `${report.score}%` : "–"}</span>
        {report.letter && report.final ? <span className="font-display text-2xl font-bold text-highlight">{report.letter}</span> : null}
        {!report.final && report.score !== null ? (
          <span className="text-xs text-secondary/70">letter on Sunday night</span>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-widest text-secondary/60">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-bold tabular-nums">
        {value}
        {sub ? <span className="ml-1 text-sm text-secondary/70">{sub}</span> : null}
      </dd>
    </div>
  );
}

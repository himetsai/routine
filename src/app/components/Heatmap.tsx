import { useEffect, useRef, useState } from "react";
import { addDays, dayOfWeek, diffDays, weekStart, type ISODate } from "../../engine";

export interface HeatCell {
  date: ISODate;
  fill: string;
  /** Tooltip text; first line is emphasized. */
  label: string;
  /** Draws a small marker (perfect day). */
  star?: boolean;
}

interface Props {
  cells: HeatCell[];
  /** Cell edge in px; the gap is a fifth of it. */
  size?: number;
}

const DOW = ["M", "", "W", "", "F", "", ""];
const LEFT = 14;

/**
 * GitHub-style grid: one column per Monday-aligned week, one row per weekday.
 * Tooltips work on hover and on tap. On narrow screens the oldest weeks are
 * dropped so the grid always fits without scrolling.
 */
export function Heatmap({ cells: allCells, size = 11 }: Props) {
  const gap = Math.max(2, Math.round(size / 5));
  const step = size + gap;
  const container = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState<number | null>(null);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const measure = () => setAvailable(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (active === null) return;
    const close = () => setActive(null);
    document.addEventListener("pointerdown", close, { capture: true, once: true });
    return () => document.removeEventListener("pointerdown", close, { capture: true });
  }, [active]);

  const last = allCells[allCells.length - 1]?.date;
  const fitWeeks = available === null ? Infinity : Math.max(4, Math.floor((available - LEFT) / step));
  const firstVisible = last && fitWeeks !== Infinity ? addDays(weekStart(last), -7 * (fitWeeks - 1)) : null;
  const cells = firstVisible ? allCells.filter((c) => c.date >= firstVisible) : allCells;
  const start = cells[0]?.date;
  const cols = start && last ? Math.floor(diffDays(start, last) / 7) + 1 : 0;
  const col = (d: ISODate) => (start ? Math.floor(diffDays(start, d) / 7) : 0);
  const activeCell = active === null ? null : cells[active];

  return (
    <div ref={container} className="relative w-full pb-1" onPointerLeave={() => setActive(null)}>
      {start ? (
        <svg width={LEFT + cols * step} height={7 * step} className="block" role="img" aria-label="Heatmap">
          {DOW.map((d, i) =>
            d ? (
              <text key={i} x={0} y={i * step + size * 0.8} fontSize={size * 0.8} className="fill-secondary/50 font-sans">
                {d}
              </text>
            ) : null,
          )}
          {cells.map((c, i) => {
            const x = LEFT + col(c.date) * step;
            const y = dayOfWeek(c.date) * step;
            return (
              <g key={c.date} onPointerEnter={() => setActive(i)} onPointerDown={(e) => (e.stopPropagation(), setActive(i))}>
                <rect x={x} y={y} width={size} height={size} rx={Math.max(2, size / 4)} fill={c.fill} className="stroke-primary/5" strokeWidth={0.5} />
                {c.star ? <circle cx={x + size / 2} cy={y + size / 2} r={size / 6} fill="white" opacity={0.9} /> : null}
                {active === i ? (
                  <rect x={x - 1} y={y - 1} width={size + 2} height={size + 2} rx={size / 4 + 1} fill="none" className="stroke-primary" strokeWidth={1.5} />
                ) : null}
              </g>
            );
          })}
        </svg>
      ) : null}
      {activeCell ? (
        <div
          className="pointer-events-none absolute z-20 whitespace-nowrap rounded-lg bg-primary px-2.5 py-1.5 text-xs text-background shadow-md"
          style={{
            left: LEFT + col(activeCell.date) * step + size / 2,
            top: dayOfWeek(activeCell.date) * step - 6,
            transform: "translate(-50%, -100%)",
          }}
        >
          {activeCell.label.split("\n").map((line, i) => (
            <div key={i} className={i === 0 ? "font-bold" : "text-background/80"}>
              {line}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function shortDate(date: ISODate): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

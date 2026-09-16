import type { WeekEval } from "../../engine";

const TONE: Record<WeekEval["state"], string> = {
  met: "bg-good/15 text-good",
  "on-track": "bg-primary/5 text-secondary",
  "at-risk": "bg-warn/15 text-warn",
  impossible: "bg-bad/15 text-bad",
  failed: "bg-bad/15 text-bad",
  excluded: "bg-primary/5 text-secondary/60",
  inactive: "bg-primary/5 text-secondary/60",
  future: "bg-primary/5 text-secondary/60",
};

function describe(ev: WeekEval): string {
  const progress = `${ev.done}/${ev.target}`;
  switch (ev.state) {
    case "met":
      return `${progress} · done for the week`;
    case "on-track":
      return `${progress} · ${ev.remaining} day${ev.remaining === 1 ? "" : "s"} left`;
    case "at-risk":
      return `${progress} · every day left`;
    case "impossible":
      return `${progress} · out of days`;
    case "failed":
      return `${progress} · missed`;
    case "excluded":
      return "paused this week";
    default:
      return progress;
  }
}

export function WeeklyChip({ eval: ev }: { eval: WeekEval }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${TONE[ev.state]}`}>
      {describe(ev)}
    </span>
  );
}

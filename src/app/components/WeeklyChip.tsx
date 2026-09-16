import type { WeekEval } from "../../engine";

const TONE: Record<WeekEval["state"], string> = {
  met: "bg-good/10 text-good",
  "on-track": "bg-fg/5 text-muted",
  "at-risk": "bg-warn/10 text-warn",
  impossible: "bg-bad/10 text-bad",
  failed: "bg-bad/10 text-bad",
  excluded: "bg-fg/5 text-muted/70",
  inactive: "bg-fg/5 text-muted/70",
  future: "bg-fg/5 text-muted/70",
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
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums ${TONE[ev.state]}`}>
      {describe(ev)}
    </span>
  );
}

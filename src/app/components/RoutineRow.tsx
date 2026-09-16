import { IMPORTANCE_LABEL, type DayStatus, type Routine, type WeekEval } from "../../engine";
import { CheckButton } from "./CheckButton";
import { WeeklyChip } from "./WeeklyChip";

interface Props {
  routine: Routine;
  status: DayStatus;
  week?: WeekEval;
  owner: boolean;
  onToggle: (routine: Routine, next: boolean) => void;
  onOpen?: (routine: Routine) => void;
}

export function RoutineRow({ routine, status, week, owner, onToggle, onOpen }: Props) {
  const done = status === "done";
  const muted = done || status === "skipped" || status === "paused";
  return (
    <li className="-mx-2 flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-fg/[0.03]">
      <CheckButton
        checked={done}
        disabled={!owner || status === "paused"}
        color={routine.color}
        label={`${done ? "Undo" : "Complete"} ${routine.name}`}
        onToggle={(next) => onToggle(routine, next)}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpen?.(routine)}
            disabled={!onOpen}
            className="flex min-w-0 items-center gap-2 text-left"
            aria-label={`Open ${routine.name}`}
          >
            <span className="text-base leading-none">{routine.emoji}</span>
            <span className={`truncate font-medium transition-colors duration-200 ${muted ? "text-muted/70 line-through decoration-muted/50" : "text-fg"}`}>
              {routine.name}
            </span>
          </button>
          <span className="ml-auto flex shrink-0 gap-0.5" title={`${IMPORTANCE_LABEL[routine.importance]} importance`} aria-label={`${IMPORTANCE_LABEL[routine.importance]} importance`}>
            {[1, 2, 3].map((n) => (
              <span key={n} className={`h-1 w-1 rounded-full ${n <= routine.importance ? "bg-muted/70" : "bg-border"}`} />
            ))}
          </span>
        </div>
        {week || status === "skipped" || status === "paused" ? (
          <div className="mt-1 flex items-center gap-2 text-xs text-muted">
            {week ? <WeeklyChip eval={week} /> : null}
            {status === "skipped" ? <span className="rounded-md bg-fg/5 px-1.5 py-0.5 font-medium">skipped today</span> : null}
            {status === "paused" ? <span className="rounded-md bg-fg/5 px-1.5 py-0.5 font-medium">paused</span> : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

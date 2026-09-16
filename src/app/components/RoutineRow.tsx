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
    <li className="flex items-center gap-3 py-2">
      <CheckButton
        checked={done}
        disabled={!owner || status === "paused"}
        color={routine.color}
        label={`${done ? "Undo" : "Complete"} ${routine.name}`}
        onToggle={(next) => onToggle(routine, next)}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <button
            type="button"
            onClick={() => onOpen?.(routine)}
            disabled={!onOpen}
            className="flex min-w-0 items-baseline gap-2 text-left"
            aria-label={`Open ${routine.name}`}
          >
            <span className="text-lg leading-none">{routine.emoji}</span>
            <span
              className={`truncate font-bold transition-colors duration-300 ${muted ? "text-secondary/50 line-through decoration-secondary/40" : "text-primary"}`}
            >
              {routine.name}
            </span>
          </button>
          <span className="ml-auto shrink-0 text-[10px] uppercase tracking-widest text-secondary/50" title={`${IMPORTANCE_LABEL[routine.importance]} importance`}>
            {"●".repeat(routine.importance)}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-secondary">
          {week ? <WeeklyChip eval={week} /> : null}
          {status === "skipped" ? <span className="rounded-full bg-primary/5 px-2 py-0.5 font-bold">skipped today</span> : null}
          {status === "paused" ? <span className="rounded-full bg-primary/5 px-2 py-0.5 font-bold">paused</span> : null}
        </div>
      </div>
    </li>
  );
}

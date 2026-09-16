import { useEffect, useState } from "react";
import {
  addDays,
  BACKFILL_DAYS,
  diffDays,
  IMPORTANCE_LABEL,
  skipsLeft,
  type Cadence,
  type Importance,
  type Index,
  type ISODate,
  type Routine,
} from "../../engine";
import { useMutate } from "../data/mutations";
import { enqueue } from "../data/outbox";
import { haptic } from "../haptics";
import { DayStrip } from "./DayStrip";
import { Sheet } from "./Sheet";

export const PALETTE = ["#ff7777", "#fb923c", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899"];
const EMOJI = ["📖", "🏋️", "✍️", "🧘", "🏃", "💧", "🦷", "🎹", "🇯🇵", "🧹", "💊", "🌙"];

interface Props {
  idx: Index;
  today: ISODate;
  /** `null` creates a new routine. */
  routine: Routine | null;
  open: boolean;
  onClose: () => void;
}

interface Draft {
  name: string;
  emoji: string;
  color: string;
  importance: Importance;
  cadence: Cadence;
}

function draftFor(idx: Index, routine: Routine | null, today: ISODate): Draft {
  return routine
    ? {
        name: routine.name,
        emoji: routine.emoji,
        color: routine.color,
        importance: routine.importance,
        cadence: idx.cadenceFor(routine, today) ?? { kind: "daily" },
      }
    : { name: "", emoji: EMOJI[0]!, color: PALETTE[0]!, importance: 2, cadence: { kind: "daily" } };
}

export function RoutineSheet({ idx, today, routine, open, onClose }: Props) {
  const { run, busy } = useMutate();
  const [draft, setDraft] = useState<Draft>(() => draftFor(idx, routine, today));
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseStart, setPauseStart] = useState(today);
  const [pauseEnd, setPauseEnd] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(draftFor(idx, routine, today));
      setPauseOpen(false);
      setPauseStart(today);
      setPauseEnd("");
    }
    // Only reset when the sheet opens or targets a different routine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, routine?.id]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const activePause = routine ? idx.pauseFor(routine.id, today) : null;
  const skipped = routine ? idx.mark(routine.id, today) === "skipped" : false;
  const left = routine ? skipsLeft(idx, routine.id, today) : 0;
  const canDelete = routine ? diffDays(routine.createdOn, today) <= 1 && !idx.hasEvents(routine.id) : false;

  async function save() {
    if (!draft.name.trim()) return;
    if (!routine) {
      const ok = await run("createRoutine", { id: crypto.randomUUID(), ...draft, name: draft.name.trim(), today });
      if (ok) onClose();
      return;
    }
    const { cadence, ...rest } = draft;
    const ok = await run("updateRoutine", { id: routine.id, ...rest, name: rest.name.trim() });
    const before = idx.cadenceFor(routine, today);
    if (ok && JSON.stringify(before) !== JSON.stringify(cadence)) {
      await run("changeCadence", { routineId: routine.id, cadence, effectiveFrom: today });
    }
    if (ok) onClose();
  }

  function skipToday() {
    if (!routine) return;
    enqueue({
      id: crypto.randomUUID(),
      routineId: routine.id,
      forDate: today,
      kind: skipped ? "unskip" : "skip",
      loggedAt: new Date().toISOString(),
      note: null,
    });
    haptic(skipped ? "uncheck" : "check");
    onClose();
  }

  async function pause() {
    if (!routine) return;
    const ok = await run("pause", {
      id: crypto.randomUUID(),
      routineId: routine.id,
      startDate: pauseStart,
      endDate: pauseEnd || null,
      note: null,
      today,
    });
    if (ok) onClose();
  }

  async function resume() {
    if (activePause && (await run("resume", { id: activePause.id, on: today }))) onClose();
  }

  async function move(delta: -1 | 1) {
    if (!routine) return;
    const ids = idx.routines.filter((r) => idx.exists(r, today)).map((r) => r.id);
    const i = ids.indexOf(routine.id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    await run("reorderRoutines", { ids });
  }

  async function archive() {
    if (routine && confirm(`Archive “${routine.name}”? Its history stays; it leaves Today.`)) {
      if (await run("archiveRoutine", { id: routine.id, on: today })) onClose();
    }
  }

  async function remove() {
    if (routine && confirm(`Delete “${routine.name}”? It has no check-ins, so nothing is lost.`)) {
      if (await run("deleteRoutine", { id: routine.id, today })) onClose();
    }
  }

  const weekly = draft.cadence.kind === "weekly";

  return (
    <Sheet open={open} onClose={onClose} title={routine ? "Routine" : "New routine"}>
      <div className="mt-4 space-y-5">
        <div className="flex gap-3">
          <label className="block">
            <span className="label">emoji</span>
            <input
              value={draft.emoji}
              onChange={(e) => set("emoji", e.target.value.slice(0, 16))}
              className="field w-16 text-center text-2xl"
              aria-label="Emoji"
            />
          </label>
          <label className="block flex-1">
            <span className="label">name</span>
            <input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Read a chapter"
              maxLength={60}
              autoFocus={!routine}
              className="field w-full"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EMOJI.map((e) => (
            <button key={e} type="button" onClick={() => set("emoji", e)} className={`rounded-md px-1.5 py-1 text-xl hover:bg-fg/5 ${draft.emoji === e ? "bg-fg/10" : ""}`}>
              {e}
            </button>
          ))}
        </div>

        <div>
          <span className="label">color</span>
          <div className="mt-1 flex gap-2">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => set("color", c)}
                className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                style={{ backgroundColor: c, borderColor: draft.color === c ? "var(--color-fg)" : "transparent" }}
              />
            ))}
          </div>
        </div>

        <div>
          <span className="label">importance</span>
          <Segmented
            options={[1, 2, 3].map((n) => ({ value: n, label: IMPORTANCE_LABEL[n as Importance] }))}
            value={draft.importance}
            onChange={(v) => set("importance", v as Importance)}
          />
        </div>

        <div>
          <span className="label">cadence</span>
          <div className="flex items-center gap-3">
            <Segmented
              options={[
                { value: "daily", label: "daily" },
                { value: "weekly", label: "per week" },
              ]}
              value={draft.cadence.kind}
              onChange={(v) => set("cadence", v === "daily" ? { kind: "daily" } : { kind: "weekly", timesPerWeek: draft.cadence.kind === "weekly" ? draft.cadence.timesPerWeek : 3 })}
            />
            {weekly ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={draft.cadence.kind === "weekly" ? draft.cadence.timesPerWeek : 3}
                  onChange={(e) => set("cadence", { kind: "weekly", timesPerWeek: Math.min(6, Math.max(1, Number(e.target.value) || 1)) })}
                  className="field w-16 text-center"
                />
                <span className="text-muted">×</span>
              </label>
            ) : null}
          </div>
          {routine && JSON.stringify(idx.cadenceFor(routine, today)) !== JSON.stringify(draft.cadence) ? (
            <p className="mt-1 text-xs text-muted/70">Takes effect next Monday; this week keeps its current target.</p>
          ) : null}
        </div>

        <button type="button" onClick={save} disabled={busy || !draft.name.trim()} className="btn-primary w-full">
          {routine ? "Save" : "Create"}
        </button>

        {routine ? (
          <>
            <hr className="border-border" />
            <div>
              <span className="label">last {BACKFILL_DAYS} days</span>
              <div className="mt-1">
                <DayStrip idx={idx} routine={routine} today={today} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={skipToday} disabled={!skipped && left === 0} className="btn-secondary">
                {skipped ? "Unskip today" : `Skip today${left ? ` · ${left} left` : " · none left"}`}
              </button>
              {activePause ? (
                <button type="button" onClick={resume} disabled={busy} className="btn-secondary">
                  Resume
                </button>
              ) : (
                <button type="button" onClick={() => setPauseOpen((v) => !v)} className="btn-secondary">
                  Pause…
                </button>
              )}
            </div>
            {activePause ? (
              <p className="text-xs text-muted/70">
                Paused since {activePause.startDate}
                {activePause.endDate ? ` until ${activePause.endDate}` : ""} · {diffDays(activePause.startDate, today) + 1} days
              </p>
            ) : null}
            {pauseOpen && !activePause ? (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex gap-2">
                  <label className="flex-1 text-xs">
                    <span className="label">from</span>
                    <input type="date" value={pauseStart} min={addDays(today, -BACKFILL_DAYS)} max={today} onChange={(e) => setPauseStart(e.target.value)} className="field w-full" />
                  </label>
                  <label className="flex-1 text-xs">
                    <span className="label">until (optional)</span>
                    <input type="date" value={pauseEnd} min={pauseStart} onChange={(e) => setPauseEnd(e.target.value)} className="field w-full" />
                  </label>
                </div>
                <button type="button" onClick={pause} disabled={busy} className="btn-primary w-full">
                  Pause
                </button>
              </div>
            ) : null}

            <div className="flex items-center justify-between text-xs text-muted">
              <div className="flex gap-1">
                <button type="button" onClick={() => move(-1)} className="link rounded-md px-2 py-1 hover:bg-fg/5" aria-label="Move up">
                  ▲ up
                </button>
                <button type="button" onClick={() => move(1)} className="link rounded-md px-2 py-1 hover:bg-fg/5" aria-label="Move down">
                  ▼ down
                </button>
              </div>
              <div className="flex gap-1">
                {canDelete ? (
                  <button type="button" onClick={remove} className="rounded-md px-2 py-1 text-bad hover:bg-bad/10">
                    delete
                  </button>
                ) : null}
                <button type="button" onClick={archive} className="link rounded-md px-2 py-1 hover:bg-fg/5">
                  archive
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Sheet>
  );
}

function Segmented<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mt-1 inline-flex rounded-lg bg-fg/5 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${o.value === value ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

import { actions } from "astro:actions";
import { useState } from "react";
import { addDays, BACKFILL_DAYS, diffDays, type Index, type ISODate } from "../../engine";
import { useMutate } from "../data/mutations";
import { refreshOwner } from "../data/owner";
import { setPrefs, usePrefs } from "../data/prefs";
import { toast } from "../data/toast";
import { Sheet } from "./Sheet";

interface Props {
  idx: Index;
  today: ISODate;
  open: boolean;
  onClose: () => void;
}

export function SettingsSheet({ idx, today, open, onClose }: Props) {
  const { run, busy } = useMutate();
  const prefs = usePrefs();
  const [pauseStart, setPauseStart] = useState(today);
  const [pauseEnd, setPauseEnd] = useState("");
  const global = idx.globalPause(today);
  const hours = Array.from({ length: 13 }, (_, h) => h);

  async function signOut() {
    await actions.logout({});
    refreshOwner();
    toast("Signed out");
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      <div className="mt-4 space-y-6">
        <label className="block">
          <span className="label">day starts at</span>
          <select
            value={idx.settings.dayCutoffHour}
            onChange={(e) => run("updateSettings", { dayCutoffHour: Number(e.target.value) })}
            className="field w-full"
          >
            {hours.map((h) => (
              <option key={h} value={h}>
                {h === 0 ? "midnight" : `${h}:00 am`}
                {h === 4 ? " (default)" : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted/70">A check-in before this hour still counts for the previous day.</p>
        </label>

        <label className="flex items-center justify-between">
          <span>
            <span className="font-semibold">Vibration</span>
            <span className="block text-xs text-muted/70">On iPhone the check itself buzzes; this covers Android patterns.</span>
          </span>
          <input type="checkbox" checked={prefs.vibrate} onChange={(e) => setPrefs({ vibrate: e.target.checked })} className="h-4 w-4 accent-fg" />
        </label>

        <div>
          <span className="label">pause everything</span>
          {global ? (
            <div className="mt-1 flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
              <span>
                Paused since {global.startDate} · {diffDays(global.startDate, today) + 1} days
              </span>
              <button type="button" disabled={busy} onClick={() => run("resume", { id: global.id, on: today }).then((ok) => ok && onClose())} className="btn-secondary">
                Resume
              </button>
            </div>
          ) : (
            <div className="mt-1 space-y-2 rounded-lg border border-border p-3">
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
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run("pause", { id: crypto.randomUUID(), routineId: null, startDate: pauseStart, endDate: pauseEnd || null, note: null, today }).then((ok) => ok && onClose())
                }
                className="btn-secondary w-full"
              >
                Pause all routines
              </button>
              <p className="text-xs text-muted/70">Vacation mode: nothing is due, streaks freeze.</p>
            </div>
          )}
        </div>

        <div>
          <span className="label">export</span>
          <div className="mt-1 flex gap-2">
            <a href={`/export.csv?today=${today}`} download className="btn-secondary flex-1 text-center">
              daily status (.csv)
            </a>
            <a href="/export.json" download className="btn-secondary flex-1 text-center">
              raw data (.json)
            </a>
          </div>
          <p className="mt-1 text-xs text-muted/70">CSV is one row per routine per day — ready for a notebook.</p>
        </div>

        <button type="button" onClick={signOut} className="link text-sm">
          sign out
        </button>
      </div>
    </Sheet>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_CUTOFF_HOUR, Index, todayFor, type ISODate, type Snapshot } from "../../engine";
import { SNAPSHOT_KEY } from "./outbox";
import { usePending } from "./pending";

async function fetchSnapshot(fresh: boolean): Promise<Snapshot> {
  const res = await fetch(fresh ? `/api/snapshot.json?fresh=${Date.now()}` : "/api/snapshot.json");
  if (!res.ok) throw new Error(`snapshot ${res.status}`);
  return res.json();
}

export function useSnapshotQuery(owner: boolean) {
  return useQuery({
    queryKey: SNAPSHOT_KEY,
    queryFn: () => fetchSnapshot(owner),
    staleTime: 30_000,
  });
}

/** The engine's view: server data plus whatever this device has not synced yet. */
export function useIndex(snapshot: Snapshot | undefined): Index | null {
  const pending = usePending();
  return useMemo(() => {
    if (!snapshot) return null;
    const known = new Set(snapshot.events.map((e) => e.id));
    const events = [...snapshot.events, ...pending.filter((e) => !known.has(e.id))];
    return new Index({ ...snapshot, events });
  }, [snapshot, pending]);
}

/** Today's routine-day, re-evaluated each minute and whenever the tab wakes up. */
export function useToday(cutoffHour = DEFAULT_CUTOFF_HOUR): ISODate {
  const [today, setToday] = useState(() => todayFor(new Date(), cutoffHour));
  useEffect(() => {
    const tick = () => setToday(todayFor(new Date(), cutoffHour));
    tick();
    const id = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [cutoffHour]);
  return today;
}

import { useSyncExternalStore } from "react";
import type { RoutineEvent } from "../../engine";

/**
 * Check-in events the device has recorded but the server has not confirmed.
 * The UI derives everything from `server events ∪ pending`, so a tap is
 * reflected instantly and survives a slow or absent network.
 */
let pending: RoutineEvent[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const pendingStore = {
  get: () => pending,
  set(next: RoutineEvent[]) {
    pending = next;
    emit();
  },
  add(event: RoutineEvent) {
    pending = [...pending.filter((e) => e.id !== event.id), event];
    emit();
  },
  remove(id: string) {
    pending = pending.filter((e) => e.id !== id);
    emit();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function usePending(): RoutineEvent[] {
  return useSyncExternalStore(pendingStore.subscribe, pendingStore.get, pendingStore.get);
}

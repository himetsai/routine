import { actions, isActionError } from "astro:actions";
import type { QueryClient } from "@tanstack/react-query";
import type { RoutineEvent, Snapshot } from "../../engine";
import { pendingStore } from "./pending";
import { toast } from "./toast";

export const SNAPSHOT_KEY = ["snapshot"] as const;

let client: QueryClient | null = null;
let flushing: Promise<void> | null = null;

export function bindOutbox(queryClient: QueryClient) {
  client = queryClient;
}

/** Record an event locally and start sending. Returns immediately. */
export function enqueue(event: RoutineEvent) {
  pendingStore.add(event);
  void flush();
}

/**
 * Send pending events in order. Definitive rejections (auth, validation,
 * budget) drop the event and tell the user; network failures leave it
 * pending for the next flush.
 */
export function flush(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    for (const event of pendingStore.get()) {
      const { error } = await actions.logEvent(event);
      if (!error) {
        confirm(event);
        continue;
      }
      if (isActionError(error)) {
        pendingStore.remove(event.id);
        toast(error.message, "error");
        continue;
      }
      break; // network: stop here, keep order, retry later
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

/** The server has the event: move it from pending into the cached snapshot. */
function confirm(event: RoutineEvent) {
  client?.setQueryData<Snapshot>(SNAPSHOT_KEY, (snap) =>
    snap && !snap.events.some((e) => e.id === event.id) ? { ...snap, events: [...snap.events, event] } : snap,
  );
  pendingStore.remove(event.id);
}

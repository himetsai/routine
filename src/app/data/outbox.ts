import { actions } from "astro:actions";
import type { QueryClient } from "@tanstack/react-query";
import { get, set } from "idb-keyval";
import { useSyncExternalStore } from "react";
import type { RoutineEvent, Snapshot } from "../../engine";
import { createOutbox } from "./outboxCore";
import { toast } from "./toast";

export const SNAPSHOT_KEY = ["snapshot"] as const;
const STORAGE_KEY = "routine:outbox";

let client: QueryClient | null = null;

export const outbox = createOutbox({
  async send(event) {
    try {
      const { error } = await actions.logEvent(event);
      if (!error) return { ok: true };
      // 5xx (cold start hiccup, deploy in progress) is transient; 4xx is the server's verdict.
      return error.status >= 500 ? { ok: false, offline: true } : { ok: false, rejected: error.message };
    } catch {
      return { ok: false, offline: true };
    }
  },
  onConfirm(event) {
    client?.setQueryData<Snapshot>(SNAPSHOT_KEY, (snap) =>
      snap && !snap.events.some((e) => e.id === event.id) ? { ...snap, events: [...snap.events, event] } : snap,
    );
  },
  onReject(_, message) {
    toast(message, "error");
  },
  storage: {
    load: async () => (await get<RoutineEvent[]>(STORAGE_KEY)) ?? [],
    save: (events) => set(STORAGE_KEY, events),
  },
});

export function bindOutbox(queryClient: QueryClient) {
  client = queryClient;
}

export const enqueue = outbox.enqueue;
export const flush = outbox.flush;

/** Events recorded on this device that the server has not confirmed yet. */
export function usePending(): RoutineEvent[] {
  return useSyncExternalStore(outbox.subscribe, outbox.get, outbox.get);
}

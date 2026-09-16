import type { RoutineEvent } from "../../engine";

export type SendResult = { ok: true } | { ok: false; rejected: string } | { ok: false; offline: true };

export interface OutboxDeps {
  /** Deliver one event. Must distinguish a definitive rejection from a network failure. */
  send: (event: RoutineEvent) => Promise<SendResult>;
  /** The server has the event. */
  onConfirm: (event: RoutineEvent) => void;
  /** The server refused the event; it has been dropped. */
  onReject: (event: RoutineEvent, message: string) => void;
  /** Durable storage for the queue (IndexedDB in the app, memory in tests). */
  storage?: { load(): Promise<RoutineEvent[]>; save(events: RoutineEvent[]): Promise<void> };
}

/**
 * A durable, ordered queue of check-in events with at-least-once delivery.
 * Events carry client UUIDs and the server ignores duplicates, so retrying is
 * always safe. Definitive rejections drop the event; network failures stop
 * the flush and leave the rest queued for next time.
 */
export function createOutbox(deps: OutboxDeps) {
  let pending: RoutineEvent[] = [];
  let flushing: Promise<void> | null = null;
  const listeners = new Set<() => void>();

  function set(next: RoutineEvent[]) {
    pending = next;
    for (const l of listeners) l();
    void deps.storage?.save(next);
  }

  function flush(): Promise<void> {
    if (flushing) return flushing;
    const run = async () => {
      try {
        // Always take the head, so events queued mid-flight are delivered in this pass.
        for (let event = pending[0]; event; event = pending[0]) {
          const result = await deps.send(event);
          if (result.ok) {
            deps.onConfirm(event);
            set(pending.filter((e) => e.id !== event.id));
          } else if ("rejected" in result) {
            set(pending.filter((e) => e.id !== event.id));
            deps.onReject(event, result.rejected);
          } else {
            break;
          }
        }
      } finally {
        // Cleared synchronously with the loop's exit, so no caller can observe a finished flush.
        flushing = null;
      }
    };
    flushing = run();
    return flushing;
  }

  return {
    get: () => pending,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    /** Queue an event and start delivering. Returns before any network I/O. */
    enqueue(event: RoutineEvent) {
      set([...pending.filter((e) => e.id !== event.id), event]);
      void flush();
    },
    flush,
    /** Load persisted events, kept ahead of anything queued since. Call `flush` when allowed. */
    async hydrate() {
      const stored = (await deps.storage?.load()) ?? [];
      const ids = new Set(pending.map((e) => e.id));
      set([...stored.filter((e) => !ids.has(e.id)), ...pending]);
    },
  };
}

export type Outbox = ReturnType<typeof createOutbox>;

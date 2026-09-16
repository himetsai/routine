import { describe, expect, it, vi } from "vitest";
import type { RoutineEvent } from "../../engine";
import { createOutbox, type SendResult } from "./outboxCore";

const ev = (id: string, kind: RoutineEvent["kind"] = "done"): RoutineEvent => ({
  id,
  routineId: "r1",
  forDate: "2026-09-16",
  kind,
  loggedAt: `2026-09-16T20:00:0${id.length}.000Z`,
  note: null,
});

function harness(script: Record<string, SendResult[]> = {}) {
  const sent: string[] = [];
  const confirmed: string[] = [];
  const rejected: [string, string][] = [];
  const store: { events: RoutineEvent[] } = { events: [] };
  const outbox = createOutbox({
    send: vi.fn(async (e: RoutineEvent): Promise<SendResult> => {
      sent.push(e.id);
      return script[e.id]?.shift() ?? { ok: true };
    }),
    onConfirm: (e) => confirmed.push(e.id),
    onReject: (e, m) => rejected.push([e.id, m]),
    storage: {
      load: async () => store.events,
      save: async (events) => {
        store.events = events;
      },
    },
  });
  return { outbox, sent, confirmed, rejected, store };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("outbox", () => {
  it("delivers in order and confirms each event", async () => {
    const h = harness();
    h.outbox.enqueue(ev("a"));
    h.outbox.enqueue(ev("b"));
    await h.outbox.flush();
    await tick();
    expect(h.sent).toEqual(["a", "b"]);
    expect(h.confirmed).toEqual(["a", "b"]);
    expect(h.outbox.get()).toEqual([]);
  });

  it("stops at a network failure, keeps the rest queued, and resumes next flush", async () => {
    const h = harness({ a: [{ ok: false, offline: true }] });
    h.outbox.enqueue(ev("a"));
    h.outbox.enqueue(ev("b"));
    await h.outbox.flush();
    await tick();
    expect(h.sent).toEqual(["a"]);
    expect(h.outbox.get().map((e) => e.id)).toEqual(["a", "b"]);
    await h.outbox.flush();
    expect(h.sent).toEqual(["a", "a", "b"]);
    expect(h.confirmed).toEqual(["a", "b"]);
  });

  it("drops a rejected event, reports it, and continues with the next", async () => {
    const h = harness({ a: [{ ok: false, rejected: "No skips left this month" }] });
    h.outbox.enqueue(ev("a", "skip"));
    h.outbox.enqueue(ev("b"));
    await h.outbox.flush();
    await tick();
    expect(h.rejected).toEqual([["a", "No skips left this month"]]);
    expect(h.confirmed).toEqual(["b"]);
    expect(h.outbox.get()).toEqual([]);
  });

  it("coalesces concurrent flushes", async () => {
    const h = harness();
    h.outbox.enqueue(ev("a"));
    const [p1, p2] = [h.outbox.flush(), h.outbox.flush()];
    expect(p1).toBe(p2);
    await p1;
    expect(h.sent).toEqual(["a"]);
  });

  it("persists the queue and restores it ahead of newer events", async () => {
    const h = harness({ a: [{ ok: false, offline: true }, { ok: false, offline: true }] });
    h.outbox.enqueue(ev("a"));
    await h.outbox.flush();
    await tick();
    expect(h.store.events.map((e) => e.id)).toEqual(["a"]);

    // A fresh session, still offline: queue something before hydration completes, then hydrate.
    let online = false;
    const sent2: string[] = [];
    const h2 = createOutbox({
      send: async (e) => {
        sent2.push(e.id);
        return online ? { ok: true } : { ok: false, offline: true };
      },
      onConfirm: () => {},
      onReject: () => {},
      storage: { load: async () => h.store.events, save: async () => {} },
    });
    h2.enqueue(ev("b"));
    await h2.hydrate();
    expect(h2.get().map((e) => e.id)).toEqual(["a", "b"]);
    online = true;
    await h2.flush();
    expect(sent2.slice(1)).toEqual(["a", "b"]);
    expect(h2.get()).toEqual([]);
  });

  it("re-enqueueing the same id replaces the earlier copy", async () => {
    const h = harness({ a: [{ ok: false, offline: true }] });
    h.outbox.enqueue(ev("a"));
    await h.outbox.flush();
    h.outbox.enqueue({ ...ev("a"), kind: "undone" });
    expect(h.outbox.get()).toHaveLength(1);
    expect(h.outbox.get()[0]?.kind).toBe("undone");
  });
});

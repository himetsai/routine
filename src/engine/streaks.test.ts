import { describe, expect, it } from "vitest";
import { build, daily, doneRange, weekly, type MarkSpec } from "./fixture";
import { milestoneReached, nextMilestone } from "./milestones";
import { skipsLeft, skipsUsed } from "./skips";
import { streak } from "./streaks";

const read = [{ id: "read", cadence: daily, createdOn: "2026-09-01" }];

describe("daily streaks", () => {
  it("counts consecutive done days; today pending keeps it open, not broken", () => {
    const idx = build({ routines: read, marks: doneRange("read", "2026-09-01", "2026-09-15") });
    expect(streak(idx, idx.routine("read")!, "2026-09-16")).toEqual({ unit: "days", current: 15, best: 15, open: true });
  });

  it("includes today once it is done", () => {
    const idx = build({ routines: read, marks: doneRange("read", "2026-09-01", "2026-09-16") });
    expect(streak(idx, idx.routine("read")!, "2026-09-16")).toMatchObject({ current: 16, open: false });
  });

  it("a skipped day bridges the streak without extending it", () => {
    const idx = build({
      routines: read,
      marks: [...doneRange("read", "2026-09-01", "2026-09-10"), ["read", "2026-09-11", "skip"], ...doneRange("read", "2026-09-12", "2026-09-15")],
    });
    expect(streak(idx, idx.routine("read")!, "2026-09-16").current).toBe(14);
  });

  it("a missed day breaks the streak and the old run becomes best", () => {
    const idx = build({
      routines: read,
      marks: [...doneRange("read", "2026-09-01", "2026-09-10"), ...doneRange("read", "2026-09-12", "2026-09-15")],
    });
    expect(streak(idx, idx.routine("read")!, "2026-09-16")).toMatchObject({ current: 4, best: 10 });
  });

  it("paused days bridge the streak", () => {
    const idx = build({
      routines: read,
      marks: [...doneRange("read", "2026-09-01", "2026-09-10"), ...doneRange("read", "2026-09-13", "2026-09-15")],
      pauses: [{ routineId: "read", startDate: "2026-09-11", endDate: "2026-09-12" }],
    });
    expect(streak(idx, idx.routine("read")!, "2026-09-16").current).toBe(13);
  });

  it("a global pause bridges too", () => {
    const idx = build({
      routines: read,
      marks: [...doneRange("read", "2026-09-01", "2026-09-10"), ...doneRange("read", "2026-09-13", "2026-09-15")],
      pauses: [{ startDate: "2026-09-11", endDate: "2026-09-12" }],
    });
    expect(streak(idx, idx.routine("read")!, "2026-09-16").current).toBe(13);
  });

  it("yesterday missed with nothing today is zero", () => {
    const idx = build({ routines: read, marks: doneRange("read", "2026-09-01", "2026-09-14") });
    expect(streak(idx, idx.routine("read")!, "2026-09-16")).toMatchObject({ current: 0, best: 14, open: true });
  });

  it("starts from nothing on a brand-new routine", () => {
    const idx = build({ routines: [{ id: "read", cadence: daily, createdOn: "2026-09-16" }] });
    expect(streak(idx, idx.routine("read")!, "2026-09-16")).toEqual({ unit: "days", current: 0, best: 0, open: true });
  });
});

describe("weekly streaks", () => {
  const gym = [{ id: "gym", cadence: weekly(2), importance: 3 as const, createdOn: "2026-08-24" }];
  const met = (mon: string, tue: string): MarkSpec[] => [["gym", mon, "done"], ["gym", tue, "done"]];

  it("counts consecutive met weeks; the current week stays open", () => {
    const idx = build({
      routines: gym,
      marks: [...met("2026-08-24", "2026-08-25"), ...met("2026-08-31", "2026-09-01"), ...met("2026-09-07", "2026-09-08"), ["gym", "2026-09-14", "done"]],
    });
    expect(streak(idx, idx.routine("gym")!, "2026-09-16")).toEqual({ unit: "weeks", current: 3, best: 3, open: true });
  });

  it("counts the current week once it is met", () => {
    const idx = build({ routines: gym, marks: [...met("2026-09-07", "2026-09-08"), ...met("2026-09-14", "2026-09-15")] });
    expect(streak(idx, idx.routine("gym")!, "2026-09-16").current).toBe(2);
  });

  it("a failed week breaks it", () => {
    const idx = build({ routines: gym, marks: [...met("2026-08-24", "2026-08-25"), ...met("2026-08-31", "2026-09-01"), ["gym", "2026-09-14", "done"]] });
    // Week of 09-07 had nothing → failed.
    expect(streak(idx, idx.routine("gym")!, "2026-09-16")).toMatchObject({ current: 0, best: 2 });
  });

  it("an impossible current week breaks it early", () => {
    const idx = build({ routines: gym, marks: [...met("2026-09-07", "2026-09-08")] });
    // Sunday 09-20 with nothing done and 2 needed: impossible.
    expect(streak(idx, idx.routine("gym")!, "2026-09-20").current).toBe(0);
  });

  it("an excluded (fully paused) week bridges", () => {
    const idx = build({
      routines: gym,
      marks: [...met("2026-08-31", "2026-09-01"), ...met("2026-09-14", "2026-09-15")],
      pauses: [{ routineId: "gym", startDate: "2026-09-07", endDate: "2026-09-13" }],
    });
    expect(streak(idx, idx.routine("gym")!, "2026-09-16").current).toBe(2);
  });
});

describe("skip budget", () => {
  it("is two per routine per calendar month", () => {
    const idx = build({
      routines: read,
      marks: [["read", "2026-08-30", "skip"], ["read", "2026-09-03", "skip"], ["read", "2026-09-10", "skip"]],
    });
    expect(skipsUsed(idx, "read", "2026-09-16")).toBe(2);
    expect(skipsLeft(idx, "read", "2026-09-16")).toBe(0);
    expect(skipsLeft(idx, "read", "2026-08-31")).toBe(1);
    expect(skipsLeft(idx, "read", "2026-10-01")).toBe(2);
  });

  it("an unskipped day gives the skip back", () => {
    const idx = build({ routines: read, marks: [["read", "2026-09-03", "skip"], ["read", "2026-09-03", "unskip"]] });
    expect(skipsLeft(idx, "read", "2026-09-16")).toBe(2);
  });
});

describe("milestones", () => {
  it("fires exactly on the thresholds", () => {
    expect(milestoneReached({ unit: "days", current: 7 })).toBe(7);
    expect(milestoneReached({ unit: "days", current: 8 })).toBeNull();
    expect(milestoneReached({ unit: "weeks", current: 12 })).toBe(12);
  });
  it("knows what is next", () => {
    expect(nextMilestone({ unit: "days", current: 8 })).toBe(30);
    expect(nextMilestone({ unit: "weeks", current: 52 })).toBeNull();
  });
});

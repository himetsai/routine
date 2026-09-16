import { describe, expect, it } from "vitest";
import { build, daily, doneRange, weekly } from "./fixture";
import { dayReport, overallHeatmap, routineHeatmap } from "./heatmap";

const routines = [
  { id: "read", cadence: daily, importance: 2 as const, createdOn: "2026-08-31" },
  { id: "floss", cadence: daily, importance: 1 as const, createdOn: "2026-08-31" },
  { id: "gym", cadence: weekly(3), importance: 3 as const, createdOn: "2026-08-31" },
];

describe("day report", () => {
  it("counts daily routines due and done; weekly ones are progress chips", () => {
    const idx = build({ routines, marks: [["read", "2026-09-16", "done"], ["gym", "2026-09-14", "done"]] });
    const r = dayReport(idx, "2026-09-16", "2026-09-16");
    expect(r.daily.map((d) => [d.routine.id, d.status])).toEqual([["read", "done"], ["floss", "pending"]]);
    expect(r).toMatchObject({ due: 2, done: 1, perfect: false });
    expect(r.weekly[0]?.eval).toMatchObject({ done: 1, target: 3, state: "on-track" });
  });

  it("is a perfect day when every due daily routine is done, regardless of weekly ones", () => {
    const idx = build({ routines, marks: [["read", "2026-09-16", "done"], ["floss", "2026-09-16", "done"]] });
    expect(dayReport(idx, "2026-09-16", "2026-09-16").perfect).toBe(true);
  });

  it("a skipped routine is not due, so the rest can still make a perfect day", () => {
    const idx = build({ routines, marks: [["read", "2026-09-16", "done"], ["floss", "2026-09-16", "skip"]] });
    expect(dayReport(idx, "2026-09-16", "2026-09-16")).toMatchObject({ due: 1, done: 1, perfect: true });
  });

  it("overall intensity is importance-weighted completions over everything active", () => {
    const at = (marks: [string, string, "done"][]) => dayReport(build({ routines, marks }), "2026-09-16", "2026-09-16").level;
    expect(at([])).toBe(0);
    expect(at([["read", "2026-09-16", "done"], ["floss", "2026-09-16", "done"]])).toBe(2); // 3 of 6 → ceil(2)
    expect(at([["gym", "2026-09-16", "done"]])).toBe(2); // 3 of 6
    expect(at([["read", "2026-09-16", "done"], ["floss", "2026-09-16", "done"], ["gym", "2026-09-16", "done"]])).toBe(4);
    expect(at([["floss", "2026-09-16", "done"]])).toBe(1); // 1 of 6 → ceil(0.67)
  });

  it("is blank when everything is paused", () => {
    const idx = build({ routines, pauses: [{ startDate: "2026-09-16", endDate: null }] });
    expect(dayReport(idx, "2026-09-16", "2026-09-16").level).toBeNull();
  });
});

describe("heatmaps", () => {
  it("covers full Monday-aligned weeks through today", () => {
    const idx = build({ routines });
    const { cells } = overallHeatmap(idx, "2026-09-16", 2);
    expect(cells[0]?.date).toBe("2026-09-07");
    expect(cells.at(-1)?.date).toBe("2026-09-16");
    expect(cells).toHaveLength(10);
  });

  it("counts perfect days and perfect weeks in the window", () => {
    const idx = build({
      routines: routines.slice(0, 2),
      marks: [...doneRange("read", "2026-09-07", "2026-09-13"), ...doneRange("floss", "2026-09-07", "2026-09-13"), ["read", "2026-09-14", "done"]],
    });
    const h = overallHeatmap(idx, "2026-09-16", 2);
    expect(h.perfectDays).toBe(7);
    expect(h.perfectWeeks).toBe(1);
  });

  it("a routine heatmap carries per-day statuses", () => {
    const idx = build({
      routines: routines.slice(0, 1),
      marks: [["read", "2026-09-14", "done"], ["read", "2026-09-15", "skip"]],
      pauses: [{ routineId: "read", startDate: "2026-09-08", endDate: "2026-09-08" }],
    });
    const cells = routineHeatmap(idx, idx.routine("read")!, "2026-09-16", 2);
    const by = Object.fromEntries(cells.map((c) => [c.date, c.status]));
    expect(by["2026-09-07"]).toBe("missed");
    expect(by["2026-09-08"]).toBe("paused");
    expect(by["2026-09-14"]).toBe("done");
    expect(by["2026-09-15"]).toBe("skipped");
    expect(by["2026-09-16"]).toBe("pending");
  });
});

import { describe, expect, it } from "vitest";
import { build, daily, doneRange, weekly, type MarkSpec } from "./fixture";
import { letterFor, trend, weekReport } from "./grade";
import { dailyWeekEval, weeklyEval } from "./status";

// Week under test: Mon 2026-09-14 … Sun 2026-09-20. Graded from the Monday after.
const WEEK = "2026-09-14";
const AFTER = "2026-09-21";

// The worked example from the design session.
const routines = [
  { id: "read", cadence: daily, importance: 2 as const, createdOn: "2026-08-31" },
  { id: "floss", cadence: daily, importance: 1 as const, createdOn: "2026-08-31" },
  { id: "gym", cadence: weekly(3), importance: 3 as const, createdOn: "2026-08-31" },
  { id: "blog", cadence: weekly(1), importance: 3 as const, createdOn: "2026-08-31" },
];
const allDaily: MarkSpec[] = [...doneRange("read", WEEK, "2026-09-20"), ...doneRange("floss", WEEK, "2026-09-20")];
const gym3: MarkSpec[] = [["gym", "2026-09-14", "done"], ["gym", "2026-09-16", "done"], ["gym", "2026-09-18", "done"]];

describe("letters", () => {
  it("maps scores to letters", () => {
    expect(letterFor(100)).toBe("A+");
    expect(letterFor(90)).toBe("A");
    expect(letterFor(89)).toBe("B");
    expect(letterFor(70)).toBe("C");
    expect(letterFor(60)).toBe("D");
    expect(letterFor(59)).toBe("F");
  });
});

describe("week grading is per-routine, importance-weighted", () => {
  it("a missed high-importance weekly post is a D even with everything else done", () => {
    const idx = build({ routines, marks: [...allDaily, ...gym3] });
    const r = weekReport(idx, WEEK, AFTER);
    expect(r.final).toBe(true);
    expect(r.score).toBe(67); // (2·1 + 1·1 + 3·1 + 3·0) / 9
    expect(r.letter).toBe("D");
    expect(r.perfect).toBe(false);
  });

  it("one missed gym session out of three is a B", () => {
    const idx = build({ routines, marks: [...allDaily, ...gym3.slice(0, 2), ["blog", "2026-09-19", "done"]] });
    const r = weekReport(idx, WEEK, AFTER);
    expect(r.score).toBe(89); // (2 + 1 + 3·⅔ + 3) / 9
    expect(r.letter).toBe("B");
  });

  it("everything done is a perfect A+ week", () => {
    const idx = build({ routines, marks: [...allDaily, ...gym3, ["blog", "2026-09-19", "done"]] });
    const r = weekReport(idx, WEEK, AFTER);
    expect(r.score).toBe(100);
    expect(r.letter).toBe("A+");
    expect(r.perfect).toBe(true);
  });

  it("the current week is provisional: graded on days so far, never marked perfect", () => {
    const idx = build({
      routines: routines.slice(0, 1),
      marks: [["read", "2026-09-14", "done"], ["read", "2026-09-15", "done"]],
    });
    const r = weekReport(idx, WEEK, "2026-09-16");
    expect(r.final).toBe(false);
    expect(r.score).toBe(67); // 2 of Mon, Tue, Wed(pending)
    expect(r.perfect).toBe(false);
  });

  it("a skipped day is excused from a daily routine's grade", () => {
    const idx = build({
      routines: routines.slice(1, 2),
      marks: [...doneRange("floss", WEEK, "2026-09-20").filter(([, d]) => d !== "2026-09-15"), ["floss", "2026-09-15", "skip"]],
    });
    expect(dailyWeekEval(idx, idx.routine("floss")!, WEEK, AFTER)).toMatchObject({ due: 6, done: 6, skips: 1 });
    expect(weekReport(idx, WEEK, AFTER).score).toBe(100);
  });

  it("a routine paused all week is excluded rather than failed", () => {
    const idx = build({
      routines,
      marks: [...allDaily, ...gym3],
      pauses: [{ routineId: "blog", startDate: "2026-09-14", endDate: "2026-09-20" }],
    });
    const r = weekReport(idx, WEEK, AFTER);
    expect(r.routines.find((g) => g.routine.id === "blog")?.ratio).toBeNull();
    expect(r.score).toBe(100);
  });

  it("returns no score when nothing was gradable", () => {
    const idx = build({ routines, pauses: [{ startDate: "2026-09-14", endDate: "2026-09-20" }] });
    const r = weekReport(idx, WEEK, AFTER);
    expect(r.score).toBeNull();
    expect(r.letter).toBeNull();
  });
});

describe("weekly routine evaluation", () => {
  const gym = routines.slice(2, 3);

  it("prorates the target when paused part of the week: 3×/wk paused Wed–Sun needs 1", () => {
    const idx = build({
      routines: gym,
      marks: [["gym", "2026-09-14", "done"]],
      pauses: [{ routineId: "gym", startDate: "2026-09-16", endDate: "2026-09-20" }],
    });
    const ev = weeklyEval(idx, idx.routine("gym")!, WEEK, AFTER);
    expect(ev).toMatchObject({ activeDays: 2, target: 1, done: 1, state: "met" });
  });

  it("a one-day pause does not change a 3×/wk target", () => {
    const idx = build({ routines: gym, pauses: [{ routineId: "gym", startDate: "2026-09-20", endDate: "2026-09-20" }] });
    expect(weeklyEval(idx, idx.routine("gym")!, WEEK, AFTER).target).toBe(3);
  });

  it("a skip lowers the week's target by one", () => {
    const idx = build({ routines: gym, marks: [...gym3.slice(0, 2), ["gym", "2026-09-19", "skip"]] });
    expect(weeklyEval(idx, idx.routine("gym")!, WEEK, AFTER)).toMatchObject({ target: 2, done: 2, skips: 1, state: "met" });
  });

  it("is on track, at risk, then impossible as days run out", () => {
    const idx = build({ routines: gym, marks: [["gym", "2026-09-14", "done"]] });
    const g = idx.routine("gym")!;
    expect(weeklyEval(idx, g, WEEK, "2026-09-16").state).toBe("on-track"); // need 2, Wed–Sun left
    expect(weeklyEval(idx, g, WEEK, "2026-09-19").state).toBe("at-risk"); // need 2, Sat+Sun left
    expect(weeklyEval(idx, g, WEEK, "2026-09-20").state).toBe("impossible"); // need 2, Sun left
    expect(weeklyEval(idx, g, WEEK, AFTER).state).toBe("failed");
  });

  it("a cadence change mid-week applies from the following Monday", () => {
    const idx = build({
      routines: [{ ...gym[0]!, changes: [["2026-09-17", weekly(4)]] }],
      marks: gym3,
    });
    const g = idx.routine("gym")!;
    expect(weeklyEval(idx, g, WEEK, AFTER)).toMatchObject({ target: 3, state: "met" });
    expect(weeklyEval(idx, g, "2026-09-21", "2026-09-28").target).toBe(4);
  });

  it("a routine created mid-week is prorated from its first day", () => {
    const idx = build({ routines: [{ id: "gym", cadence: weekly(3), createdOn: "2026-09-18" }] });
    // Fri, Sat, Sun → round(3 × 3/7) = 1
    expect(weeklyEval(idx, idx.routine("gym")!, WEEK, AFTER)).toMatchObject({ activeDays: 3, target: 1, state: "failed" });
    expect(weeklyEval(idx, idx.routine("gym")!, "2026-09-07", AFTER).state).toBe("inactive");
  });
});

describe("trend", () => {
  it("averages the last completed weeks and ignores the current one", () => {
    const read = [{ id: "read", cadence: daily, createdOn: "2026-08-31" }];
    const idx = build({
      routines: read,
      marks: [
        ...doneRange("read", "2026-08-31", "2026-09-06"), // 100
        ...doneRange("read", "2026-09-07", "2026-09-12"), // 6/7 = 86
        ...doneRange("read", "2026-09-14", "2026-09-15"), // current week, ignored
      ],
    });
    expect(trend(idx, "2026-09-16", 4)).toBe(93);
  });

  it("is null before any week has completed", () => {
    const idx = build({ routines: [{ id: "read", cadence: daily, createdOn: "2026-09-14" }] });
    expect(trend(idx, "2026-09-16")).toBeNull();
  });
});

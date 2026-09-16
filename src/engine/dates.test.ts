import { describe, expect, it } from "vitest";
import { addDays, dayOfWeek, diffDays, eachDay, monthKey, todayFor, weekEnd, weekStart } from "./dates";

describe("todayFor (day cutoff)", () => {
  it("counts 1:30 am as the previous day with a 4 am cutoff", () => {
    expect(todayFor(new Date(2026, 8, 17, 1, 30), 4)).toBe("2026-09-16");
  });
  it("rolls over exactly at the cutoff hour", () => {
    expect(todayFor(new Date(2026, 8, 17, 3, 59), 4)).toBe("2026-09-16");
    expect(todayFor(new Date(2026, 8, 17, 4, 0), 4)).toBe("2026-09-17");
  });
  it("is plain midnight with a 0 cutoff", () => {
    expect(todayFor(new Date(2026, 8, 17, 0, 0), 0)).toBe("2026-09-17");
  });
});

describe("weeks start on Monday", () => {
  it("finds Monday and Sunday around a Wednesday", () => {
    expect(weekStart("2026-09-16")).toBe("2026-09-14");
    expect(weekEnd("2026-09-16")).toBe("2026-09-20");
  });
  it("keeps Monday and Sunday in their own week", () => {
    expect(weekStart("2026-09-14")).toBe("2026-09-14");
    expect(weekStart("2026-09-20")).toBe("2026-09-14");
    expect(dayOfWeek("2026-09-14")).toBe(0);
    expect(dayOfWeek("2026-09-20")).toBe(6);
  });
});

describe("date arithmetic", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(diffDays("2026-08-31", "2026-09-07")).toBe(7);
    expect(diffDays("2026-09-07", "2026-08-31")).toBe(-7);
  });
  it("enumerates inclusive ranges", () => {
    expect(eachDay("2026-09-29", "2026-10-02")).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
    expect(eachDay("2026-09-02", "2026-09-01")).toEqual([]);
  });
  it("extracts month keys", () => {
    expect(monthKey("2026-09-16")).toBe("2026-09");
  });
});

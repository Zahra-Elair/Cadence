import { describe, it, expect } from "vitest";
import { layoutDayEvents, wallMinutes, type CalendarEvent } from "./layout";

const ev = (title: string, start: string, end: string, allDay = false): CalendarEvent => ({ title, start, end, allDay });

describe("wallMinutes", () => {
  it("reads minutes-from-midnight from the ISO wall clock", () => {
    expect(wallMinutes("2026-09-30T09:30:00+01:00")).toBe(570);
    expect(wallMinutes("2026-09-30T00:00:00Z")).toBe(0);
  });
});

describe("layoutDayEvents", () => {
  it("excludes all-day events", () => {
    const out = layoutDayEvents([ev("Trip", "2026-09-30T00:00:00+01:00", "2026-10-01T00:00:00+01:00", true)], { pxPerHour: 48 });
    expect(out).toHaveLength(0);
  });

  it("positions a timed event by start/end", () => {
    const [p] = layoutDayEvents([ev("Standup", "2026-09-30T09:00:00+01:00", "2026-09-30T10:00:00+01:00")], { pxPerHour: 48 });
    expect(p.top).toBe(9 * 48);
    expect(p.height).toBe(48);
    expect(p.laneIndex).toBe(0);
    expect(p.laneCount).toBe(1);
  });

  it("gives non-overlapping events full width (laneCount 1)", () => {
    const out = layoutDayEvents([
      ev("A", "2026-09-30T09:00:00+01:00", "2026-09-30T10:00:00+01:00"),
      ev("B", "2026-09-30T11:00:00+01:00", "2026-09-30T12:00:00+01:00"),
    ], { pxPerHour: 48 });
    expect(out.every((p) => p.laneCount === 1 && p.laneIndex === 0)).toBe(true);
  });

  it("splits two overlapping events into 2 lanes", () => {
    const out = layoutDayEvents([
      ev("Meeting", "2026-09-30T13:00:00+01:00", "2026-09-30T14:00:00+01:00"),
      ev("Coffee", "2026-09-30T13:00:00+01:00", "2026-09-30T13:30:00+01:00"),
    ], { pxPerHour: 48 });
    expect(out.every((p) => p.laneCount === 2)).toBe(true);
    expect(out.map((p) => p.laneIndex).sort()).toEqual([0, 1]);
  });

  it("splits a 3-way overlap into 3 lanes", () => {
    const out = layoutDayEvents([
      ev("A", "2026-09-30T13:00:00+01:00", "2026-09-30T14:30:00+01:00"),
      ev("B", "2026-09-30T13:15:00+01:00", "2026-09-30T14:00:00+01:00"),
      ev("C", "2026-09-30T13:30:00+01:00", "2026-09-30T14:15:00+01:00"),
    ], { pxPerHour: 48 });
    expect(out.every((p) => p.laneCount === 3)).toBe(true);
  });

  it("applies a minimum height to very short events", () => {
    const [p] = layoutDayEvents([ev("Quick", "2026-09-30T09:00:00+01:00", "2026-09-30T09:05:00+01:00")], { pxPerHour: 48, minHeight: 18 });
    expect(p.height).toBe(18);
  });
});

import { describe, it, expect } from "vitest";
import { computeNowNext } from "./now-next";
import type { CalendarEvent } from "./layout";

const ev = (title: string, start: string, end: string, allDay = false): CalendarEvent => ({ title, start, end, allDay });
const ZONE = "Africa/Lagos"; // +01:00

const today = [
  ev("Standup", "2026-10-01T09:00:00+01:00", "2026-10-01T09:30:00+01:00"),
  ev("Meeting", "2026-10-01T11:00:00+01:00", "2026-10-01T12:00:00+01:00"),
  ev("Gym", "2026-10-01T17:00:00+01:00", "2026-10-01T18:00:00+01:00"),
  ev("Lunch", "2026-10-02T13:00:00+01:00", "2026-10-02T14:00:00+01:00"),
];

describe("computeNowNext", () => {
  it("finds the next event and remaining count before the day starts filling", () => {
    const r = computeNowNext(today, "2026-10-01T10:00:00+01:00", ZONE);
    expect(r.current).toBeUndefined();
    expect(r.next?.title).toBe("Meeting");
    expect(r.remainingToday).toBe(2); // Meeting + Gym
    expect(r.freeAfterISO).toContain("18:00"); // last end today
  });

  it("reports the event happening now", () => {
    const r = computeNowNext(today, "2026-10-01T11:30:00+01:00", ZONE);
    expect(r.current?.title).toBe("Meeting");
    expect(r.next?.title).toBe("Gym");
    expect(r.remainingToday).toBe(1);
  });

  it("looks ahead to a later day when nothing remains today", () => {
    const r = computeNowNext(today, "2026-10-01T19:00:00+01:00", ZONE);
    expect(r.current).toBeUndefined();
    expect(r.next?.title).toBe("Lunch");
    expect(r.remainingToday).toBe(0);
    expect(r.freeAfterISO).toBeUndefined(); // already past today's events
  });

  it("is empty when there are no events", () => {
    const r = computeNowNext([], "2026-10-01T10:00:00+01:00", ZONE);
    expect(r.next).toBeUndefined();
    expect(r.remainingToday).toBe(0);
    expect(r.allDayToday).toEqual([]);
  });

  it("lists all-day events on today's date", () => {
    const r = computeNowNext([ev("Holiday", "2026-10-01", "2026-10-02", true), ...today], "2026-10-01T10:00:00+01:00", ZONE);
    expect(r.allDayToday).toEqual(["Holiday"]);
    expect(r.next?.title).toBe("Meeting"); // all-day excluded from timed next
  });
});

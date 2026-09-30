import { describe, it, expect, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { email: "u@x.com" } })) }));
vi.mock("./auth-token", () => ({ getGoogleAccessToken: vi.fn(async () => "tok") }));
vi.mock("./google-calendar", () => ({
  listEventsInRange: vi.fn(async () => [
    { id: "e1", title: "Standup", start: new Date("2026-09-30T08:00:00Z"), end: new Date("2026-09-30T08:30:00Z"), allDay: false, location: "Room 1", attendees: [], description: "sync" },
  ]),
}));

import { fetchCalendarWeek } from "./calendar-actions";

describe("fetchCalendarWeek", () => {
  it("returns events mapped to ISO in the user's timezone", async () => {
    const res = await fetchCalendarWeek("2026-09-28T00:00:00+01:00", "Africa/Lagos");
    expect(res.ok).toBe(true);
    if (res.ok) {
      const e = res.events[0];
      expect(e.id).toBe("e1");
      expect(e.title).toBe("Standup");
      expect(e.description).toBe("sync");
      // 08:00Z in Africa/Lagos (UTC+1) → 09:00 local
      expect(e.start).toBe("2026-09-30T09:00:00+01:00");
      expect(e.allDay).toBe(false);
    }
  });
});

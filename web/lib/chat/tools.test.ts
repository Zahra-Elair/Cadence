import { describe, it, expect, vi } from "vitest";

vi.mock("../google-calendar", () => ({
  listEventsInRange: vi.fn(async () => [
    { id: "e1", title: "Standup", start: new Date("2026-09-25T09:00:00Z"), end: new Date("2026-09-25T09:15:00Z"), allDay: false, location: undefined, attendees: [] },
  ]),
}));

import { buildTools } from "./tools";

describe("buildTools", () => {
  it("exposes all four tools", () => {
    const tools = buildTools("tok", "Africa/Lagos");
    expect(Object.keys(tools).sort()).toEqual(
      ["create_event", "delete_event", "list_events", "update_event"].sort(),
    );
  });

  it("list_events has an execute; write tools do not", () => {
    const tools = buildTools("tok", "Africa/Lagos") as Record<string, { execute?: unknown }>;
    expect(typeof tools.list_events.execute).toBe("function");
    expect(tools.create_event.execute).toBeUndefined();
    expect(tools.update_event.execute).toBeUndefined();
    expect(tools.delete_event.execute).toBeUndefined();
  });

  it("list_events.execute returns events in the user's timezone, not UTC", async () => {
    // Event at 09:00 UTC, displayed for a user in Africa/Lagos (UTC+1) → 10:00 local.
    const tools = buildTools("tok", "Africa/Lagos") as unknown as Record<string, { execute: (a: unknown) => Promise<unknown> }>;
    const out = (await tools.list_events.execute({ timeMin: "2026-09-25T00:00:00Z", timeMax: "2026-09-26T00:00:00Z" })) as { events: Array<{ id: string; start: string; end: string }> };
    expect(out.events[0].id).toBe("e1");
    expect(out.events[0].start).toBe("2026-09-25T10:00:00+01:00");
    expect(out.events[0].end).toBe("2026-09-25T10:15:00+01:00");
  });
});

import { describe, it, expect, vi } from "vitest";

vi.mock("../google-calendar", () => ({
  listEventsInRange: vi.fn(async () => [
    { id: "e1", title: "Standup", start: new Date("2026-09-25T09:00:00Z"), end: new Date("2026-09-25T09:15:00Z"), allDay: false, location: undefined, attendees: [] },
  ]),
}));

import { buildTools } from "./tools";

describe("buildTools", () => {
  it("exposes all four tools", () => {
    const tools = buildTools("tok");
    expect(Object.keys(tools).sort()).toEqual(
      ["create_event", "delete_event", "list_events", "update_event"].sort(),
    );
  });

  it("list_events has an execute; write tools do not", () => {
    const tools = buildTools("tok") as Record<string, { execute?: unknown }>;
    expect(typeof tools.list_events.execute).toBe("function");
    expect(tools.create_event.execute).toBeUndefined();
    expect(tools.update_event.execute).toBeUndefined();
    expect(tools.delete_event.execute).toBeUndefined();
  });

  it("list_events.execute returns ISO-mapped events", async () => {
    const tools = buildTools("tok") as unknown as Record<string, { execute: (a: unknown) => Promise<unknown> }>;
    const out = (await tools.list_events.execute({ timeMin: "2026-09-25T00:00:00Z", timeMax: "2026-09-26T00:00:00Z" })) as { events: Array<{ id: string; start: string }> };
    expect(out.events[0].id).toBe("e1");
    expect(out.events[0].start).toBe("2026-09-25T09:00:00.000Z");
  });
});

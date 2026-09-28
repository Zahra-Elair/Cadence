import { describe, it, expect, vi } from "vitest";
import { mapGoogleEvent, createEvent, updateEvent, deleteEvent } from "./google-calendar";

describe("mapGoogleEvent", () => {
  it("maps a timed event", () => {
    const e = mapGoogleEvent({
      summary: "Design review",
      start: { dateTime: "2026-09-22T14:00:00Z" },
      end: { dateTime: "2026-09-22T15:00:00Z" },
      location: "Room 4B",
      attendees: [{ email: "a@x.com" }, { displayName: "Bob" }],
      description: "d",
    });
    expect(e.title).toBe("Design review");
    expect(e.allDay).toBe(false);
    expect(e.location).toBe("Room 4B");
    expect(e.attendees).toEqual(["a@x.com", "Bob"]);
    expect(e.start.toISOString()).toBe("2026-09-22T14:00:00.000Z");
  });

  it("maps an all-day event", () => {
    const e = mapGoogleEvent({
      summary: "Holiday",
      start: { date: "2026-09-22" },
      end: { date: "2026-09-23" },
    });
    expect(e.allDay).toBe(true);
    expect(e.attendees).toEqual([]);
  });

  it("defaults a missing title", () => {
    const e = mapGoogleEvent({ start: { dateTime: "2026-09-22T09:00:00Z" }, end: { dateTime: "2026-09-22T09:15:00Z" } });
    expect(e.title).toBe("(no title)");
  });
});

function okJson(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}
function errStatus(status: number) {
  return { ok: false, status, text: async () => "err" } as unknown as Response;
}

describe("mapGoogleEvent id", () => {
  it("carries the Google event id", () => {
    const e = mapGoogleEvent({
      id: "evt123",
      summary: "X",
      start: { dateTime: "2026-09-25T13:00:00Z" },
      end: { dateTime: "2026-09-25T14:00:00Z" },
    });
    expect(e.id).toBe("evt123");
  });
});

describe("createEvent", () => {
  it("POSTs to events.insert and returns the new id", async () => {
    const fetchMock = vi.fn(async () => okJson({ id: "new1", htmlLink: "http://x" }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await createEvent("tok", {
      title: "Lunch", start: "2026-09-25T13:00:00+01:00", end: "2026-09-25T14:00:00+01:00",
    });
    expect(res.id).toBe("new1");
    const [url, init] = (fetchMock.mock.calls as any[])[0];
    expect(String(url)).toContain("/calendars/primary/events");
    expect((init as RequestInit).method).toBe("POST");
    vi.unstubAllGlobals();
  });

  it("maps a 403 to SCOPE_DENIED", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => errStatus(403)));
    await expect(
      createEvent("tok", { title: "X", start: "2026-09-25T13:00:00Z", end: "2026-09-25T14:00:00Z" }),
    ).rejects.toMatchObject({ code: "SCOPE_DENIED" });
    vi.unstubAllGlobals();
  });
});

describe("updateEvent / deleteEvent", () => {
  it("PATCHes events.patch", async () => {
    const fetchMock = vi.fn(async () => okJson({ id: "e1" }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await updateEvent("tok", "e1", { title: "New" });
    expect(res.id).toBe("e1");
    expect(((fetchMock.mock.calls as any[])[0][1] as RequestInit).method).toBe("PATCH");
    vi.unstubAllGlobals();
  });

  it("DELETEs events and resolves on 204", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 204 } as unknown as Response));
    vi.stubGlobal("fetch", fetchMock);
    await expect(deleteEvent("tok", "e1")).resolves.toBeUndefined();
    expect(((fetchMock.mock.calls as any[])[0][1] as RequestInit).method).toBe("DELETE");
    vi.unstubAllGlobals();
  });
});

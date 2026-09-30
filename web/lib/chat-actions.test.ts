import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { email: "u@x.com" } })) }));
vi.mock("./auth-token", () => ({ getGoogleAccessToken: vi.fn(async () => "tok") }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createEvent = vi.fn(async () => ({ id: "e1", htmlLink: "L" })) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const updateEvent = vi.fn(async () => ({ id: "e1" })) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const deleteEvent = vi.fn(async () => undefined) as any;
vi.mock("./google-calendar", () => ({
  createEvent: (...a: unknown[]) => (createEvent as any)(...a),
  updateEvent: (...a: unknown[]) => (updateEvent as any)(...a),
  deleteEvent: (...a: unknown[]) => (deleteEvent as any)(...a),
}));

import { executeWrite } from "./chat-actions";

beforeEach(() => { createEvent.mockClear(); updateEvent.mockClear(); deleteEvent.mockClear(); });

describe("executeWrite", () => {
  it("creates a valid event via createEvent", async () => {
    const res = await executeWrite("create_event", { title: "Lunch", start: "2026-09-25T13:00:00Z", end: "2026-09-25T14:00:00Z" });
    expect(res.ok).toBe(true);
    expect(createEvent).toHaveBeenCalledOnce();
    if (res.ok) expect(res.output.id).toBe("e1");
  });

  it("rejects invalid args WITHOUT touching the calendar", async () => {
    const res = await executeWrite("create_event", { title: "", start: "bad", end: "bad" });
    expect(res.ok).toBe(false);
    expect(createEvent).not.toHaveBeenCalled();
  });

  it("deletes and returns { deleted: true }", async () => {
    const res = await executeWrite("delete_event", { eventId: "e1" });
    expect(res.ok).toBe(true);
    expect(deleteEvent).toHaveBeenCalledOnce();
    if (res.ok) expect(res.output.deleted).toBe(true);
  });

  it("updates a valid event via updateEvent", async () => {
    const res = await executeWrite("update_event", { eventId: "e1", title: "New" });
    expect(res.ok).toBe(true);
    expect(updateEvent).toHaveBeenCalledOnce();
  });
});

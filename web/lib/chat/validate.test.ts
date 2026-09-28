import { describe, it, expect } from "vitest";
import { validateWriteArgs } from "./validate";

describe("validateWriteArgs", () => {
  it("accepts a well-formed create_event", () => {
    expect(validateWriteArgs("create_event", {
      title: "Lunch", start: "2026-09-25T13:00:00+01:00", end: "2026-09-25T14:00:00+01:00",
    })).toEqual({ ok: true });
  });
  it("rejects create_event with no title", () => {
    const r = validateWriteArgs("create_event", { start: "2026-09-25T13:00:00Z", end: "2026-09-25T14:00:00Z" });
    expect(r.ok).toBe(false);
  });
  it("rejects create_event when end is not after start", () => {
    const r = validateWriteArgs("create_event", { title: "X", start: "2026-09-25T14:00:00Z", end: "2026-09-25T13:00:00Z" });
    expect(r.ok).toBe(false);
  });
  it("rejects create_event with an invalid start", () => {
    const r = validateWriteArgs("create_event", { title: "X", start: "not-a-date", end: "2026-09-25T14:00:00Z" });
    expect(r.ok).toBe(false);
  });
  it("requires eventId for delete_event", () => {
    expect(validateWriteArgs("delete_event", {}).ok).toBe(false);
    expect(validateWriteArgs("delete_event", { eventId: "e1" })).toEqual({ ok: true });
  });
  it("update_event with a start requires a valid end after it", () => {
    expect(validateWriteArgs("update_event", { eventId: "e1", start: "2026-09-25T14:00:00Z", end: "2026-09-25T13:00:00Z" }).ok).toBe(false);
    expect(validateWriteArgs("update_event", { eventId: "e1", title: "New" })).toEqual({ ok: true });
  });
});

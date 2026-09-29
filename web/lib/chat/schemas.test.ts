import { describe, it, expect } from "vitest";
import { validateWriteArgs } from "./schemas";

describe("validateWriteArgs", () => {
  it("create_event: valid args pass", () => {
    expect(validateWriteArgs("create_event", {
      title: "Lunch", start: "2026-09-25T13:00:00Z", end: "2026-09-25T14:00:00Z",
    })).toEqual({ ok: true });
  });
  it("create_event: end before start fails", () => {
    const r = validateWriteArgs("create_event", {
      title: "X", start: "2026-09-25T14:00:00Z", end: "2026-09-25T13:00:00Z",
    });
    expect(r.ok).toBe(false);
  });
  it("create_event: bad ISO fails", () => {
    const r = validateWriteArgs("create_event", { title: "X", start: "bad", end: "also-bad" });
    expect(r.ok).toBe(false);
  });
  it("create_event: empty title fails", () => {
    const r = validateWriteArgs("create_event", {
      title: "", start: "2026-09-25T13:00:00Z", end: "2026-09-25T14:00:00Z",
    });
    expect(r.ok).toBe(false);
  });
  it("delete_event: requires eventId", () => {
    expect(validateWriteArgs("delete_event", { eventId: "abc" })).toEqual({ ok: true });
    expect(validateWriteArgs("delete_event", {}).ok).toBe(false);
  });
  it("update_event: eventId only is valid (no time change)", () => {
    expect(validateWriteArgs("update_event", { eventId: "abc", title: "New" })).toEqual({ ok: true });
  });
  it("update_event: changing only one of start/end fails", () => {
    const r = validateWriteArgs("update_event", { eventId: "abc", start: "2026-09-25T13:00:00Z" });
    expect(r.ok).toBe(false);
  });
  it("update_event: end before start is rejected", () => {
    const r = validateWriteArgs("update_event", {
      eventId: "abc", start: "2026-09-25T14:00:00Z", end: "2026-09-25T13:00:00Z",
    });
    expect(r.ok).toBe(false);
  });
  it("update_event: missing eventId is rejected", () => {
    expect(validateWriteArgs("update_event", { title: "x" }).ok).toBe(false);
  });
  it("update_event: valid start/end pair is accepted", () => {
    expect(validateWriteArgs("update_event", {
      eventId: "abc", start: "2026-09-25T13:00:00Z", end: "2026-09-25T14:00:00Z",
    })).toEqual({ ok: true });
  });
});

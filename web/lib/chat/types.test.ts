import { describe, it, expect } from "vitest";
import { summarizeWrite } from "./types";

describe("summarizeWrite", () => {
  it("create shows the title and time", () => {
    const s = summarizeWrite("create_event", {
      title: "Lunch", start: "2026-09-25T13:00:00Z", end: "2026-09-25T14:00:00Z",
    });
    expect(s).toContain("Lunch");
  });

  it("formats the time compactly from the ISO offset (no raw ISO, seconds, or slashes)", () => {
    const s = summarizeWrite("create_event", {
      title: "Hair", start: "2026-09-30T17:00:00+01:00", end: "2026-09-30T18:00:00+01:00",
    });
    expect(s).toMatch(/5\s*–\s*6 PM/); // wall-clock 17:00–18:00 → 5–6 PM, server-tz-independent
    expect(s).not.toContain(":00:00");
    expect(s).not.toContain("/");
  });

  it("delete shows the human-readable title, never the raw id", () => {
    const s = summarizeWrite("delete_event", {
      eventId: "ml1cp26gnl8tgaf0rep8s94vcg", eventTitle: "Nails appointment",
    });
    expect(s).toContain("Nails appointment");
    expect(s).not.toContain("ml1cp26gnl8tgaf0rep8s94vcg");
  });

  it("delete without a title falls back to a generic phrase, still no raw id", () => {
    const s = summarizeWrite("delete_event", { eventId: "ml1cp26gnl8tgaf0rep8s94vcg" });
    expect(s).not.toContain("ml1cp26gnl8tgaf0rep8s94vcg");
    expect(s.toLowerCase()).toContain("this event");
  });

  it("update shows the title and the change, never the raw id", () => {
    const s = summarizeWrite("update_event", {
      eventId: "abc123xyz", eventTitle: "Standup",
      start: "2026-09-25T09:00:00Z", end: "2026-09-25T09:30:00Z",
    });
    expect(s).toContain("Standup");
    expect(s).not.toContain("abc123xyz");
  });

  it("past tense yields completed-action verbs for the chat trace", () => {
    expect(summarizeWrite("create_event", { title: "Lunch", start: "2026-09-25T13:00:00Z", end: "2026-09-25T14:00:00Z" }, true)).toMatch(/^Created /);
    expect(summarizeWrite("update_event", { eventId: "x", eventTitle: "Standup" }, true)).toMatch(/^Updated /);
    expect(summarizeWrite("delete_event", { eventId: "x", eventTitle: "Nails" }, true)).toMatch(/^Deleted /);
  });
});

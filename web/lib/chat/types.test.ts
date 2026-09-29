import { describe, it, expect } from "vitest";
import { summarizeWrite } from "./types";

describe("summarizeWrite", () => {
  it("create shows the title and time", () => {
    const s = summarizeWrite("create_event", {
      title: "Lunch", start: "2026-09-25T13:00:00Z", end: "2026-09-25T14:00:00Z",
    });
    expect(s).toContain("Lunch");
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
});

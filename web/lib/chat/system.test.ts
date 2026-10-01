import { describe, it, expect } from "vitest";
import { buildSystem } from "./system";

describe("buildSystem viewContext", () => {
  it("includes the viewed week when weekStartISO is given", () => {
    const s = buildSystem("Africa/Lagos", { weekStartISO: "2026-09-28T00:00:00+01:00" });
    expect(s).toContain("currently viewing the week of");
  });
  it("omits the viewed-week line without context", () => {
    expect(buildSystem("Africa/Lagos")).not.toContain("currently viewing the week of");
  });
  it("mentions a selected day when given", () => {
    const s = buildSystem("Africa/Lagos", { weekStartISO: "2026-09-28T00:00:00+01:00", selectedDayISO: "2026-10-01" });
    expect(s.toLowerCase()).toContain("selected");
  });
});

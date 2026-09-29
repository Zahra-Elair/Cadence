import { describe, it, expect } from "vitest";
import { initialSummaryState, summaryReducer, shouldFetch } from "./summary-state";
import type { Summary } from "@/lib/engine/types";

const sum = (overview: string): Summary => ({
  period: "weekly", start: "s", end: "e", overview, keyEvents: [], timeBreakdown: "1h", highlights: [], empty: false,
});

describe("summary-state", () => {
  it("starts on the given period with an empty cache and wants a fetch", () => {
    const s = initialSummaryState("weekly");
    expect(s.period).toBe("weekly");
    expect(shouldFetch(s, "weekly")).toBe(true);
  });

  it("caches a loaded summary and no longer wants a fetch for it", () => {
    let s = initialSummaryState("weekly");
    s = summaryReducer(s, { type: "loading", period: "weekly" });
    s = summaryReducer(s, { type: "loaded", period: "weekly", summary: sum("Busy week") });
    expect(shouldFetch(s, "weekly")).toBe(false);
    const cell = s.byPeriod.weekly!;
    expect(cell.status === "loaded" && cell.summary.overview).toBe("Busy week");
  });

  it("wants a fetch for an uncached period even when another is loaded", () => {
    let s = initialSummaryState("weekly");
    s = summaryReducer(s, { type: "loaded", period: "weekly", summary: sum("x") });
    s = summaryReducer(s, { type: "select", period: "daily" });
    expect(s.period).toBe("daily");
    expect(shouldFetch(s, "daily")).toBe(true);
    expect(shouldFetch(s, "weekly")).toBe(false);
  });

  it("retries after an error (error cell still wants a fetch)", () => {
    let s = initialSummaryState("monthly");
    s = summaryReducer(s, { type: "error", period: "monthly", error: "boom", needsSignIn: false });
    expect(shouldFetch(s, "monthly")).toBe(true);
    const cell = s.byPeriod.monthly!;
    expect(cell.status).toBe("error");
  });
});

import { describe, it, expect } from "vitest";
import { buildRRule, describeRecurrence } from "./recurrence";

describe("buildRRule", () => {
  it("weekly on weekdays with a count", () => {
    expect(buildRRule({ frequency: "weekly", weekdays: ["MO", "TU", "WE", "TH", "FR"], count: 5 }, "Africa/Lagos"))
      .toBe("RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;COUNT=5");
  });

  it("orders and de-duplicates weekdays", () => {
    expect(buildRRule({ frequency: "weekly", weekdays: ["FR", "MO", "MO"] }, "UTC"))
      .toBe("RRULE:FREQ=WEEKLY;BYDAY=MO,FR");
  });

  it("weekly with no weekdays omits BYDAY", () => {
    expect(buildRRule({ frequency: "weekly" }, "UTC")).toBe("RRULE:FREQ=WEEKLY");
  });

  it("daily with an until date converts to inclusive end-of-day UTC", () => {
    // 2026-09-25 23:59:59 in Africa/Lagos (+01:00) == 22:59:59 UTC.
    expect(buildRRule({ frequency: "daily", until: "2026-09-25" }, "Africa/Lagos"))
      .toBe("RRULE:FREQ=DAILY;UNTIL=20260925T225959Z");
  });

  it("includes INTERVAL when greater than 1", () => {
    expect(buildRRule({ frequency: "weekly", interval: 2 }, "UTC")).toBe("RRULE:FREQ=WEEKLY;INTERVAL=2");
  });

  it("interval of 1 is omitted", () => {
    expect(buildRRule({ frequency: "daily", interval: 1 }, "UTC")).toBe("RRULE:FREQ=DAILY");
  });

  it("monthly", () => {
    expect(buildRRule({ frequency: "monthly" }, "UTC")).toBe("RRULE:FREQ=MONTHLY");
  });

  it("count takes precedence over until", () => {
    expect(buildRRule({ frequency: "daily", count: 3, until: "2026-09-25" }, "UTC"))
      .toBe("RRULE:FREQ=DAILY;COUNT=3");
  });
});

describe("describeRecurrence", () => {
  it("names the Mon-Fri set as 'every weekday'", () => {
    expect(describeRecurrence({ frequency: "weekly", weekdays: ["MO", "TU", "WE", "TH", "FR"], until: "2026-09-25" }))
      .toBe("every weekday, until 25 Sep");
  });

  it("all seven days reads as 'every day'", () => {
    expect(describeRecurrence({ frequency: "weekly", weekdays: ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] }))
      .toBe("every day");
  });

  it("a subset of weekdays lists them", () => {
    expect(describeRecurrence({ frequency: "weekly", weekdays: ["MO", "WE"] })).toBe("weekly on Mon, Wed");
  });

  it("daily with a count", () => {
    expect(describeRecurrence({ frequency: "daily", count: 10 })).toBe("daily, 10 times");
  });

  it("interval phrasing", () => {
    expect(describeRecurrence({ frequency: "monthly", interval: 2 })).toBe("every 2 months");
  });

  it("bare weekly", () => {
    expect(describeRecurrence({ frequency: "weekly" })).toBe("weekly");
  });
});

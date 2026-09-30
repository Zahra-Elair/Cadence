import { DateTime } from "luxon";

export const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export type Frequency = "daily" | "weekly" | "monthly";

export interface Recurrence {
  frequency: Frequency;
  /** Repeat every N periods (default 1). */
  interval?: number;
  /** For weekly recurrence: which weekdays it lands on. */
  weekdays?: Weekday[];
  /** Inclusive end date of the series (ISO 8601). Mutually exclusive with count. */
  until?: string;
  /** Number of occurrences. Mutually exclusive with until. */
  count?: number;
}

const FREQ: Record<Frequency, string> = { daily: "DAILY", weekly: "WEEKLY", monthly: "MONTHLY" };
const WD_LABEL: Record<Weekday, string> = {
  MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun",
};
const WEEKDAY_SET: Weekday[] = ["MO", "TU", "WE", "TH", "FR"];

/** De-duplicate and sort weekdays into Mon→Sun order for stable output. */
function orderWeekdays(days: Weekday[]): Weekday[] {
  return Array.from(new Set(days)).sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b));
}

function sameWeekdays(a: Weekday[], b: Weekday[]): boolean {
  return a.length === b.length && a.every((d, i) => d === b[i]);
}

/**
 * Compile a structured recurrence to a Google / RFC-5545 RRULE line.
 * `until` is treated as inclusive through the end of that day in the user's
 * timezone, then converted to UTC (RRULE requires a UTC UNTIL for a zoned
 * DTSTART). `count` takes precedence when both are somehow present.
 */
export function buildRRule(rec: Recurrence, timeZone: string): string {
  const parts: string[] = [`FREQ=${FREQ[rec.frequency]}`];
  if (rec.interval && rec.interval > 1) parts.push(`INTERVAL=${rec.interval}`);
  if (rec.frequency === "weekly" && rec.weekdays?.length) {
    parts.push(`BYDAY=${orderWeekdays(rec.weekdays).join(",")}`);
  }
  if (rec.count !== undefined) {
    parts.push(`COUNT=${rec.count}`);
  } else if (rec.until) {
    const zoned = DateTime.fromISO(rec.until, { zone: timeZone });
    const end = (zoned.isValid ? zoned : DateTime.fromISO(rec.until)).endOf("day").toUTC();
    if (end.isValid) parts.push(`UNTIL=${end.toFormat("yyyyLLdd'T'HHmmss'Z'")}`);
  }
  return `RRULE:${parts.join(";")}`;
}

/** Human-readable phrase for a confirmation card, e.g. "every weekday, until 25 Sep". */
export function describeRecurrence(rec: Recurrence): string {
  const n = rec.interval && rec.interval > 1 ? rec.interval : 0;
  let base: string;
  if (rec.frequency === "daily") {
    base = n ? `every ${n} days` : "daily";
  } else if (rec.frequency === "monthly") {
    base = n ? `every ${n} months` : "monthly";
  } else {
    const wd = orderWeekdays(rec.weekdays ?? []);
    const labels = wd.map((d) => WD_LABEL[d]).join(", ");
    if (n) base = `every ${n} weeks${wd.length ? ` on ${labels}` : ""}`;
    else if (wd.length === 7) base = "every day";
    else if (sameWeekdays(wd, WEEKDAY_SET)) base = "every weekday";
    else if (wd.length) base = `weekly on ${labels}`;
    else base = "weekly";
  }

  if (rec.count !== undefined) return `${base}, ${rec.count} times`;
  if (rec.until) {
    const d = DateTime.fromISO(rec.until);
    return `${base}, until ${d.isValid ? d.toFormat("d LLL") : rec.until}`;
  }
  return base;
}

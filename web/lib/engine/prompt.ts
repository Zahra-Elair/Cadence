import { DateTime } from "luxon";
import type { CalEvent, Period } from "./types";

/** Render an absolute instant as an ISO string in the user's timezone, so the
 *  model reads local wall-clock times. Date.toISOString() is always UTC, which
 *  would silently shift every time by the user's offset. */
function toLocalISO(d: Date, zone: string): string {
  const dt = DateTime.fromJSDate(d).setZone(zone);
  return dt.isValid ? dt.toISO({ suppressMilliseconds: true })! : d.toISOString();
}

function roundHalfToEven(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  const x = value * factor;
  const fl = Math.floor(x);
  const diff = x - fl;
  let r: number;
  if (diff < 0.5) r = fl;
  else if (diff > 0.5) r = fl + 1;
  else r = fl % 2 === 0 ? fl : fl + 1; // exactly .5 → nearest even
  return r / factor;
}

export function totalScheduledHours(events: CalEvent[]): number {
  const totalMs = events.reduce(
    (acc, e) => acc + (e.allDay ? 0 : e.end.getTime() - e.start.getTime()),
    0,
  );
  return roundHalfToEven(totalMs / 3_600_000, 1);
}

function formatEvent(e: CalEvent, zone: string): string {
  const when = e.allDay
    ? `${toLocalISO(e.start, zone).slice(0, 10)} (all day)`
    : `${toLocalISO(e.start, zone)}–${toLocalISO(e.end, zone)}`;
  const parts = [when, e.title];
  if (e.location) parts.push(`@ ${e.location}`);
  if (e.attendees.length) parts.push(`with ${e.attendees.join(", ")}`);
  return parts.join(" | ");
}

export function buildPrompt(
  events: CalEvent[], period: Period, startISO: string, endISO: string, zone = "UTC",
): string {
  const eventsBlock = events.length ? events.map((e) => formatEvent(e, zone)).join("\n") : "(no events)";
  const hours = totalScheduledHours(events);
  return [
    "You are a helpful assistant that summarizes a person's calendar.",
    `Write a ${period} summary for the period ${startISO} (inclusive) to ${endISO} (exclusive).`,
    `All event times below are in the user's timezone (${zone}); read and report them exactly as written — do not shift them by any offset.`,
    "",
    `Total scheduled hours (computed for you, use it — do not invent numbers): ${hours}`,
    `Number of events: ${events.length}`,
    "",
    `Events:\n${eventsBlock}`,
    "",
    "For a daily summary be concrete and time-ordered. For weekly or monthly, zoom out to themes, busiest days, and overall load rather than listing every event.",
    "",
    'Respond ONLY with a JSON object with exactly these keys: "overview" (string, 1-2 sentences), "keyEvents" (array of short strings), "timeBreakdown" (string), "highlights" (array of short strings).',
  ].join("\n");
}

import { DateTime } from "luxon";
import type { CalendarEvent } from "./layout";

export interface NowNext {
  /** A timed event happening right now, if any. */
  current?: CalendarEvent;
  /** The next upcoming timed event (today or later), if any. */
  next?: CalendarEvent;
  /** Count of timed events starting later today (after now). */
  remainingToday: number;
  /** End of the last timed event today, when now is before it (ISO in zone). */
  freeAfterISO?: string;
  /** Titles of all-day events on today's date. */
  allDayToday: string[];
}

/**
 * Derive a "now / next" glance from a set of events, relative to `nowISO`.
 * Pure and framework-free — the component renders what this returns.
 */
export function computeNowNext(events: CalendarEvent[], nowISO: string, zone: string): NowNext {
  const now = DateTime.fromISO(nowISO, { zone });
  const timed = events
    .filter((e) => !e.allDay)
    .map((e) => ({ e, s: DateTime.fromISO(e.start, { zone }), en: DateTime.fromISO(e.end, { zone }) }))
    .filter((x) => x.s.isValid && x.en.isValid)
    .sort((a, b) => a.s.toMillis() - b.s.toMillis());

  const current = timed.find((x) => x.s <= now && now < x.en)?.e;
  const upcoming = timed.filter((x) => x.s > now);
  const next = upcoming[0]?.e;
  const remainingToday = upcoming.filter((x) => x.s.hasSame(now, "day")).length;

  const endsToday = timed.filter((x) => x.en.hasSame(now, "day") || x.s.hasSame(now, "day"));
  const lastEndToday = endsToday.reduce<DateTime | undefined>(
    (acc, x) => (!acc || x.en > acc ? x.en : acc),
    undefined,
  );
  const freeAfterISO = lastEndToday && lastEndToday > now ? lastEndToday.toISO({ suppressMilliseconds: true })! : undefined;

  const allDayToday = events
    .filter((e) => e.allDay && DateTime.fromISO(e.start, { zone }).hasSame(now, "day"))
    .map((e) => e.title);

  return { current, next, remainingToday, freeAfterISO, allDayToday };
}

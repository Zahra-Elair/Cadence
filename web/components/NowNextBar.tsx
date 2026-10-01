"use client";
import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import type { CalendarEvent } from "@/lib/calendar/layout";
import { fetchCalendarWeek } from "@/lib/calendar-actions";
import { computeNowNext } from "@/lib/calendar/now-next";
import { Clock } from "lucide-react";

function fmtTime(dt: DateTime): string {
  return dt.minute === 0 ? dt.toFormat("h a") : dt.toFormat("h:mm a");
}

/** "in 20m" / "in 2h 10m" / "tomorrow 9 AM" / "Fri 2 PM" */
function whenLabel(startISO: string, nowISO: string, zone: string): string {
  const s = DateTime.fromISO(startISO, { zone });
  const now = DateTime.fromISO(nowISO, { zone });
  if (s.hasSame(now, "day")) {
    const mins = Math.max(0, Math.round(s.diff(now, "minutes").minutes));
    if (mins < 60) return `in ${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `in ${h}h` : `in ${h}h ${m}m`;
  }
  if (s.hasSame(now.plus({ days: 1 }), "day")) return `tomorrow ${fmtTime(s)}`;
  return `${s.toFormat("EEE")} ${fmtTime(s)}`;
}

/** Today-centric "now / next" glance. Reflects the real current time, independent
 *  of the week being viewed, and refreshes when `refreshKey` changes (after writes). */
export function NowNextBar({ zone, refreshKey = 0 }: { zone: string; refreshKey?: number }) {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [tick, setTick] = useState(0); // drives the countdown refresh

  useEffect(() => {
    let alive = true;
    const weekStart = DateTime.now().setZone(zone).startOf("week").toISO()!;
    fetchCalendarWeek(weekStart, zone)
      .then((res) => { if (alive && res.ok) setEvents(res.events); })
      .catch(() => {});
    return () => { alive = false; };
  }, [zone, refreshKey]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const nowISO = useMemo(() => DateTime.now().setZone(zone).toISO()!, [zone, tick, events]);
  const nn = useMemo(() => (events ? computeNowNext(events, nowISO, zone) : null), [events, nowISO, zone]);

  const primary = (() => {
    if (!nn) return "Loading your day…";
    if (nn.current) return `Now: ${nn.current.title} · until ${fmtTime(DateTime.fromISO(nn.current.end, { zone }))}`;
    if (nn.next) return `Next up: ${nn.next.title} · ${whenLabel(nn.next.start, nowISO, zone)}`;
    return "Nothing coming up this week.";
  })();

  const secondary = (() => {
    if (!nn) return null;
    const parts: string[] = [];
    if (nn.remainingToday > 0) parts.push(`${nn.remainingToday} more today`);
    if (nn.freeAfterISO) parts.push(`free after ${fmtTime(DateTime.fromISO(nn.freeAfterISO, { zone }))}`);
    else if (nn.remainingToday === 0 && !nn.current) parts.push("nothing else today");
    if (nn.allDayToday.length) parts.push(`${nn.allDayToday.join(", ")} (all day)`);
    return parts.length ? parts.join(" · ") : null;
  })();

  return (
    <div className="flex items-start gap-3 rounded-2xl border bg-card px-4 py-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Clock className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{primary}</p>
        {secondary && <p className="truncate text-sm text-muted-foreground">{secondary}</p>}
      </div>
    </div>
  );
}

"use client";
import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import { signIn } from "next-auth/react";
import type { CalendarEvent } from "@/lib/calendar/layout";
import { fetchCalendarWeek } from "@/lib/calendar-actions";
import { WeekGrid } from "./WeekGrid";
import { EventDialog } from "./EventDialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

type Dialog = { mode: "create" | "edit"; event?: CalendarEvent; dayISODate?: string; hour?: number } | null;

export function CalendarClient() {
  const zone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const [anchor, setAnchor] = useState(() => DateTime.now().setZone(zone).startOf("week"));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => anchor.plus({ days: i })), [anchor]);
  const todayISODate = DateTime.now().setZone(zone).toISODate()!;
  const weekStartISO = anchor.toISO()!;

  async function load() {
    setLoading(true); setError(null); setNeedsSignIn(false);
    const res = await fetchCalendarWeek(weekStartISO, zone);
    setLoading(false);
    if (res.ok) setEvents(res.events);
    else { setError(res.error); setNeedsSignIn(Boolean(res.needsSignIn)); }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [weekStartISO]);

  const rangeLabel = `${anchor.toFormat("d LLL")} – ${anchor.plus({ days: 6 }).toFormat("d LLL yyyy")}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => setAnchor(anchor.minus({ weeks: 1 }))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={() => setAnchor(DateTime.now().setZone(zone).startOf("week"))}>Today</Button>
          <Button variant="outline" size="icon" aria-label="Next week" onClick={() => setAnchor(anchor.plus({ weeks: 1 }))}><ChevronRight className="h-4 w-4" /></Button>
          <span className="ml-1 text-sm font-medium">{rangeLabel}</span>
        </div>
        <Button onClick={() => setDialog({ mode: "create", dayISODate: todayISODate, hour: 9 })}><Plus className="mr-1 h-4 w-4" /> New event</Button>
      </div>

      {error && (
        <Alert variant="destructive"><AlertDescription className="space-y-3">
          <p>{error}</p>
          {needsSignIn && <Button onClick={() => signIn("google", { redirectTo: "/calendar" })}>Sign in with Google</Button>}
        </AlertDescription></Alert>
      )}

      <div className={loading ? "opacity-60" : ""}>
        <WeekGrid weekDays={weekDays} events={events} todayISODate={todayISODate}
          onEventClick={(event) => setDialog({ mode: "edit", event })}
          onSlotClick={(dayISODate, hour) => setDialog({ mode: "create", dayISODate, hour })} />
      </div>

      {dialog && (
        <EventDialog
          key={`${dialog.mode}-${dialog.event?.id ?? dialog.dayISODate ?? ""}-${dialog.hour ?? ""}`}
          open mode={dialog.mode} timeZone={zone}
          initial={{ event: dialog.event, dayISODate: dialog.dayISODate, hour: dialog.hour }}
          onClose={() => setDialog(null)} onSaved={load} />
      )}
    </div>
  );
}

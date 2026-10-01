"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";
import { signIn } from "next-auth/react";
import type { CalendarEvent } from "@/lib/calendar/layout";
import { fetchCalendarWeek } from "@/lib/calendar-actions";
import { WeekGrid } from "./WeekGrid";
import { EventDialog } from "./EventDialog";
import { NowNextBar } from "./NowNextBar";
import { ChatClient } from "./ChatClient";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ChevronLeft, ChevronRight, Plus, MessageSquareText, PanelRightClose, PanelRightOpen } from "lucide-react";

type DialogState = { mode: "create" | "edit"; event?: CalendarEvent; dayISODate?: string; hour?: number } | null;

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return desktop;
}

export function WorkspaceClient() {
  const zone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const [anchor, setAnchor] = useState(() => DateTime.now().setZone(zone).startOf("week"));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [selectedDayISO, setSelectedDayISO] = useState<string | undefined>(undefined);
  const [dockOpen, setDockOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const reqId = useRef(0);
  const isDesktop = useIsDesktop();

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => anchor.plus({ days: i })), [anchor]);
  const todayISODate = DateTime.now().setZone(zone).toISODate()!;
  const weekStartISO = anchor.toISO()!;
  const anchorISODate = anchor.toISODate()!;

  async function load() {
    const id = ++reqId.current;
    setLoading(true); setError(null); setNeedsSignIn(false);
    try {
      const res = await fetchCalendarWeek(weekStartISO, zone);
      if (id !== reqId.current) return;
      if (res.ok) setEvents(res.events);
      else { setError(res.error); setNeedsSignIn(Boolean(res.needsSignIn)); }
    } catch {
      if (id === reqId.current) setError("Couldn't load your calendar. Please try again.");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [weekStartISO]);
  useEffect(() => { setSelectedDayISO(undefined); }, [weekStartISO]);

  // Refetch the viewed week AND nudge the Now/Next bar after a write.
  function reloadAll() { void load(); setRefreshKey((k) => k + 1); }

  const rangeLabel = `${anchor.toFormat("d LLL")} – ${anchor.plus({ days: 6 }).toFormat("d LLL yyyy")}`;
  const viewContext = useMemo(() => ({ weekStartISO, selectedDayISO }), [weekStartISO, selectedDayISO]);

  if (!mounted) return <div className="h-[70vh] animate-pulse rounded-xl border" />;

  const chat = <ChatClient viewContext={viewContext} onWriteComplete={reloadAll} />;

  return (
    <div className="space-y-4">
      <NowNextBar zone={zone} refreshKey={refreshKey} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => setAnchor(anchor.minus({ weeks: 1 }))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={() => setAnchor(DateTime.now().setZone(zone).startOf("week"))}>Today</Button>
          <Button variant="outline" size="icon" aria-label="Next week" onClick={() => setAnchor(anchor.plus({ weeks: 1 }))}><ChevronRight className="h-4 w-4" /></Button>
          <input
            type="date"
            aria-label="Jump to a date"
            value={anchorISODate}
            onChange={(e) => { const d = DateTime.fromISO(e.target.value, { zone }); if (d.isValid) setAnchor(d.startOf("week")); }}
            className="ml-1 h-9 rounded-md border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [color-scheme:light] dark:[color-scheme:dark]"
          />
          <span className="ml-1 text-sm font-medium">{rangeLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setDialog({ mode: "create", dayISODate: selectedDayISO ?? todayISODate, hour: 9 })}><Plus className="mr-1 h-4 w-4" /> New event</Button>
          {isDesktop && (
            <Button variant="outline" size="icon" aria-label={dockOpen ? "Hide assistant" : "Show assistant"} onClick={() => setDockOpen((v) => !v)}>
              {dockOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive"><AlertDescription className="space-y-3">
          <p>{error}</p>
          {needsSignIn && <Button onClick={() => signIn("google", { redirectTo: "/app" })}>Sign in with Google</Button>}
        </AlertDescription></Alert>
      )}

      <div className="flex gap-4">
        <div className={`min-w-0 flex-1 ${loading ? "opacity-60" : ""}`}>
          <WeekGrid
            weekDays={weekDays}
            events={events}
            todayISODate={todayISODate}
            onEventClick={(event) => { setSelectedDayISO(event.start.slice(0, 10)); setDialog({ mode: "edit", event }); }}
            onSlotClick={(dayISODate, hour) => { setSelectedDayISO(dayISODate); setDialog({ mode: "create", dayISODate, hour }); }}
          />
        </div>
        {isDesktop && dockOpen && (
          <aside className="w-[380px] shrink-0">
            <div className="sticky top-4 rounded-2xl border bg-card p-3">
              <p className="px-1 pb-2 text-sm font-medium text-muted-foreground">Assistant</p>
              {chat}
            </div>
          </aside>
        )}
      </div>

      {!isDesktop && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button className="fixed bottom-5 right-5 z-20 rounded-full shadow-lg"><MessageSquareText className="mr-1 h-4 w-4" /> Ask Cadence</Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] p-4">
            <SheetTitle className="mb-2 text-base">Assistant</SheetTitle>
            <SheetDescription className="sr-only">Chat with the Cadence assistant to view or change your calendar.</SheetDescription>
            {chat}
          </SheetContent>
        </Sheet>
      )}

      {dialog && (
        <EventDialog
          key={`${dialog.mode}-${dialog.event?.id ?? dialog.dayISODate ?? ""}-${dialog.hour ?? ""}`}
          open
          mode={dialog.mode}
          timeZone={zone}
          initial={{ event: dialog.event, dayISODate: dialog.dayISODate, hour: dialog.hour }}
          onClose={() => setDialog(null)}
          onSaved={reloadAll}
        />
      )}
    </div>
  );
}

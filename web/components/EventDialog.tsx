"use client";
import { useState } from "react";
import { DateTime } from "luxon";
import type { CalendarEvent } from "@/lib/calendar/layout";
import { executeWrite } from "@/lib/chat-actions";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function isoToParts(iso: string) { return { date: iso.slice(0, 10), time: iso.slice(11, 16) }; }

export function EventDialog({ open, mode, initial, timeZone, onClose, onSaved }: {
  open: boolean;
  mode: "create" | "edit";
  initial: { event?: CalendarEvent; dayISODate?: string; hour?: number };
  timeZone: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const seed = () => {
    if (mode === "edit" && initial.event) {
      const s = isoToParts(initial.event.start), e = isoToParts(initial.event.end);
      return { title: initial.event.title, date: s.date, startTime: s.time, endTime: e.time, location: initial.event.location ?? "", description: initial.event.description ?? "" };
    }
    const date = initial.dayISODate ?? DateTime.now().setZone(timeZone).toISODate()!;
    const h = initial.hour ?? 9;
    return { title: "", date, startTime: `${String(h).padStart(2, "0")}:00`, endTime: `${String((h + 1) % 24).padStart(2, "0")}:00`, location: "", description: "" };
  };
  const [f, setF] = useState(seed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function isoOf(date: string, time: string): string {
    return DateTime.fromISO(`${date}T${time}`, { zone: timeZone }).toISO({ suppressMilliseconds: true })!;
  }

  async function save() {
    setError(null);
    if (!f.title.trim()) { setError("Give the event a title."); return; }
    const start = isoOf(f.date, f.startTime), end = isoOf(f.date, f.endTime);
    if (Date.parse(end) <= Date.parse(start)) { setError("End must be after start."); return; }
    setBusy(true);
    const res = mode === "create"
      ? await executeWrite("create_event", { title: f.title, start, end, location: f.location || undefined, description: f.description || undefined })
      : await executeWrite("update_event", { eventId: initial.event!.id!, title: f.title, start, end, location: f.location || undefined, description: f.description || undefined });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    onSaved(); onClose();
  }

  async function remove() {
    setBusy(true);
    const res = await executeWrite("delete_event", { eventId: initial.event!.id!, eventTitle: initial.event!.title });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    onSaved(); onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{mode === "create" ? "New event" : "Edit event"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Event title" /></div>
          <div className="space-y-1"><Label>Date</Label><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Start</Label><Input type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} /></div>
            <div className="space-y-1"><Label>End</Label><Input type="time" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} /></div>
          </div>
          <div className="space-y-1"><Label>Location</Label><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Optional" /></div>
          <div className="space-y-1"><Label>Notes</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Optional" /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {mode === "edit" ? (
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="destructive" disabled={busy}>Delete</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Delete this event?</AlertDialogTitle>
                  <AlertDialogDescription>“{initial.event?.title}” will be removed from your calendar.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={remove}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

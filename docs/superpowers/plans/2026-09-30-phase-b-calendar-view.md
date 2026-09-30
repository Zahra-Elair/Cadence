# Phase B Calendar View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A custom week time-grid calendar view with full CRUD via forms (click event → edit/delete, click slot → create), reusing the existing Google Calendar write path.

**Architecture:** A `/calendar` page renders `CalendarClient` (week state + per-week fetch/cache + dialogs), which renders `WeekGrid` (presentational). Event positioning + overlap lanes live in the pure, tested `lib/calendar/layout.ts`. Reads use a new `fetchCalendarWeek` server action over `listEventsInRange`; writes reuse `executeWrite`. No drag-drop, no library, no DB.

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, TypeScript strict, Tailwind v4, shadcn/ui (radix-nova), Luxon, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-30-phase-b-calendar-view-design.md` (read alongside).

## Global Constraints

- **Week only**, built **custom** (no calendar library). Week starts **Monday** (ISO). Full-day grid (00:00–24:00), vertically scrollable.
- **Full CRUD via forms** — no AI confirm card on the calendar; the form + a delete `AlertDialog` is the confirmation. **No drag-and-drop.**
- **Writes reuse `executeWrite(tool, args)`** from `@/lib/chat-actions` (`create_event`/`update_event`/`delete_event`); `start`/`end` are ISO-8601 with the user's offset. After a successful write, re-fetch the current week.
- **No change** to chat/streaming, summaries/dashboard, `lib/ai/*`, `auth.ts`, or the Google Calendar CRUD functions. `mapGoogleEvent` already maps `description` — do NOT modify `google-calendar.ts`.
- Violet theme + light/dark via existing tokens; shadcn radix-nova. TypeScript strict.
- Per `web/AGENTS.md`: skim `node_modules/next/dist/docs/` before server-component/action code; never remove the auto-generated AGENTS.md block.
- Every task ends `tsc --noEmit` clean; Tasks 1–2 end `vitest` green; the final task runs `tsc && vitest && next build` + a manual live checklist. All paths relative to `web/`.

## Notes from the codebase

- `listEventsInRange(token, timeMin, timeMax): Promise<CalEvent[]>` — `CalEvent` = `{ id?, title, start: Date, end: Date, allDay, location?, attendees: string[], description? }`.
- `executeWrite(tool, args): Promise<{ ok: true; output } | { ok: false; error; needsSignIn? }>` — validates + executes with the user's token.
- `auth()` (`@/auth`), `getGoogleAccessToken()` (`@/lib/auth-token`), `isQuota`/`isOverload` (`@/lib/ai/errors`).
- Header has a `NAV` array (`[{href:"/dashboard",label},{href:"/assistant",label}]`) rendered with active-state styling.

---

## File Structure

| File | Responsibility | Task |
|------|----------------|------|
| `lib/calendar/layout.ts` (+ `.test.ts`) | `CalendarEvent`/`PositionedEvent` types + `layoutDayEvents` (position + overlap lanes) | 1 |
| `lib/calendar-actions.ts` (+ `.test.ts`) | `fetchCalendarWeek` server action | 2 |
| `components/WeekGrid.tsx` | headers + all-day row + time grid + event blocks | 3 |
| `components/EventDialog.tsx` | create/edit form + delete confirm | 4 |
| `components/CalendarClient.tsx` | week state, fetch/cache, nav, dialog orchestration | 5 |
| `app/calendar/page.tsx` | server page: gate + Header + CalendarClient | 5 |
| `components/Header.tsx` | add "Calendar" nav entry | 5 |
| `components/ui/*` | add shadcn `dialog`, `alert-dialog`, `textarea`, `label` | 3 |

---

## Task 1: `lib/calendar/layout.ts` — positioning + overlap lanes (TDD)

**Files:** Create `lib/calendar/layout.ts`, `lib/calendar/layout.test.ts`.

**Interfaces:**
- Produces:
  - `interface CalendarEvent { id?: string; title: string; start: string; end: string; allDay: boolean; location?: string; description?: string }`
  - `interface PositionedEvent { event: CalendarEvent; top: number; height: number; laneIndex: number; laneCount: number }`
  - `wallMinutes(iso: string): number` — minutes from midnight of the ISO's wall-clock time (0 if unparseable).
  - `layoutDayEvents(events: CalendarEvent[], opts: { pxPerHour: number; minHeight?: number }): PositionedEvent[]`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { layoutDayEvents, wallMinutes, type CalendarEvent } from "./layout";

const ev = (title: string, start: string, end: string, allDay = false): CalendarEvent => ({ title, start, end, allDay });

describe("wallMinutes", () => {
  it("reads minutes-from-midnight from the ISO wall clock", () => {
    expect(wallMinutes("2026-09-30T09:30:00+01:00")).toBe(570);
    expect(wallMinutes("2026-09-30T00:00:00Z")).toBe(0);
  });
});

describe("layoutDayEvents", () => {
  it("excludes all-day events", () => {
    const out = layoutDayEvents([ev("Trip", "2026-09-30T00:00:00+01:00", "2026-10-01T00:00:00+01:00", true)], { pxPerHour: 48 });
    expect(out).toHaveLength(0);
  });

  it("positions a timed event by start/end", () => {
    const [p] = layoutDayEvents([ev("Standup", "2026-09-30T09:00:00+01:00", "2026-09-30T10:00:00+01:00")], { pxPerHour: 48 });
    expect(p.top).toBe(9 * 48);
    expect(p.height).toBe(48);
    expect(p.laneIndex).toBe(0);
    expect(p.laneCount).toBe(1);
  });

  it("gives non-overlapping events full width (laneCount 1)", () => {
    const out = layoutDayEvents([
      ev("A", "2026-09-30T09:00:00+01:00", "2026-09-30T10:00:00+01:00"),
      ev("B", "2026-09-30T11:00:00+01:00", "2026-09-30T12:00:00+01:00"),
    ], { pxPerHour: 48 });
    expect(out.every((p) => p.laneCount === 1 && p.laneIndex === 0)).toBe(true);
  });

  it("splits two overlapping events into 2 lanes", () => {
    const out = layoutDayEvents([
      ev("Meeting", "2026-09-30T13:00:00+01:00", "2026-09-30T14:00:00+01:00"),
      ev("Coffee", "2026-09-30T13:00:00+01:00", "2026-09-30T13:30:00+01:00"),
    ], { pxPerHour: 48 });
    expect(out.every((p) => p.laneCount === 2)).toBe(true);
    expect(out.map((p) => p.laneIndex).sort()).toEqual([0, 1]);
  });

  it("splits a 3-way overlap into 3 lanes", () => {
    const out = layoutDayEvents([
      ev("A", "2026-09-30T13:00:00+01:00", "2026-09-30T14:30:00+01:00"),
      ev("B", "2026-09-30T13:15:00+01:00", "2026-09-30T14:00:00+01:00"),
      ev("C", "2026-09-30T13:30:00+01:00", "2026-09-30T14:15:00+01:00"),
    ], { pxPerHour: 48 });
    expect(out.every((p) => p.laneCount === 3)).toBe(true);
  });

  it("applies a minimum height to very short events", () => {
    const [p] = layoutDayEvents([ev("Quick", "2026-09-30T09:00:00+01:00", "2026-09-30T09:05:00+01:00")], { pxPerHour: 48, minHeight: 18 });
    expect(p.height).toBe(18);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/calendar/layout.test.ts`
Expected: FAIL — cannot find module `./layout`.

- [ ] **Step 3: Implement `lib/calendar/layout.ts`**

```ts
export interface CalendarEvent {
  id?: string;
  title: string;
  start: string; // ISO 8601 with the user's offset
  end: string;
  allDay: boolean;
  location?: string;
  description?: string;
}

export interface PositionedEvent {
  event: CalendarEvent;
  top: number;
  height: number;
  laneIndex: number;
  laneCount: number;
}

/** Minutes from midnight of the ISO string's wall-clock time (offset-agnostic). */
export function wallMinutes(iso: string): number {
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function layoutDayEvents(
  events: CalendarEvent[],
  { pxPerHour, minHeight = 18 }: { pxPerHour: number; minHeight?: number },
): PositionedEvent[] {
  const timed = events
    .filter((e) => !e.allDay)
    .map((e) => ({ e, s: wallMinutes(e.start), en: Math.max(wallMinutes(e.start) + 1, wallMinutes(e.end)) }))
    .sort((a, b) => a.s - b.s || a.en - b.en);

  // Assign each event the lowest lane whose last event ended at/before this start.
  const laneEnds: number[] = [];
  const laneOf = new Map<number, number>();
  timed.forEach((t, i) => {
    let lane = laneEnds.findIndex((end) => end <= t.s);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(t.en); }
    else laneEnds[lane] = t.en;
    laneOf.set(i, lane);
  });

  // laneCount per event = max concurrent lanes across its connected overlap cluster.
  const clusterCount = new Array(timed.length).fill(1);
  let i = 0;
  while (i < timed.length) {
    let j = i;
    let clusterEnd = timed[i].en;
    let lanesUsed = new Set<number>([laneOf.get(i)!]);
    while (j + 1 < timed.length && timed[j + 1].s < clusterEnd) {
      j += 1;
      clusterEnd = Math.max(clusterEnd, timed[j].en);
      lanesUsed.add(laneOf.get(j)!);
    }
    const count = lanesUsed.size;
    for (let k = i; k <= j; k++) clusterCount[k] = count;
    i = j + 1;
  }

  return timed.map((t, idx) => ({
    event: t.e,
    top: (t.s / 60) * pxPerHour,
    height: Math.max(minHeight, ((t.en - t.s) / 60) * pxPerHour),
    laneIndex: laneOf.get(idx)!,
    laneCount: clusterCount[idx],
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/calendar/layout.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/calendar/layout.ts lib/calendar/layout.test.ts
git commit -m "feat(web): tested week-grid event positioning + overlap lanes"
```

---

## Task 2: `fetchCalendarWeek` server action (TDD)

**Files:** Create `lib/calendar-actions.ts`, `lib/calendar-actions.test.ts`.

**Interfaces:**
- Consumes: `CalendarEvent` (`@/lib/calendar/layout`), `listEventsInRange` (`@/lib/google-calendar`), `auth`, `getGoogleAccessToken`, Luxon.
- Produces: `fetchCalendarWeek(weekStartISO: string, timeZone: string): Promise<{ ok: true; events: CalendarEvent[] } | { ok: false; error: string; needsSignIn?: boolean }>`.

- [ ] **Step 1: Write the failing test**

Create `lib/calendar-actions.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { email: "u@x.com" } })) }));
vi.mock("./auth-token", () => ({ getGoogleAccessToken: vi.fn(async () => "tok") }));
vi.mock("./google-calendar", () => ({
  listEventsInRange: vi.fn(async () => [
    { id: "e1", title: "Standup", start: new Date("2026-09-30T08:00:00Z"), end: new Date("2026-09-30T08:30:00Z"), allDay: false, location: "Room 1", attendees: [], description: "sync" },
  ]),
}));

import { fetchCalendarWeek } from "./calendar-actions";

describe("fetchCalendarWeek", () => {
  it("returns events mapped to ISO in the user's timezone", async () => {
    const res = await fetchCalendarWeek("2026-09-28T00:00:00+01:00", "Africa/Lagos");
    expect(res.ok).toBe(true);
    if (res.ok) {
      const e = res.events[0];
      expect(e.id).toBe("e1");
      expect(e.title).toBe("Standup");
      expect(e.description).toBe("sync");
      // 08:00Z in Africa/Lagos (UTC+1) → 09:00 local
      expect(e.start).toBe("2026-09-30T09:00:00+01:00");
      expect(e.allDay).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/calendar-actions.test.ts`
Expected: FAIL — cannot find module `./calendar-actions`.

- [ ] **Step 3: Implement `lib/calendar-actions.ts`**

```ts
"use server";

import { DateTime } from "luxon";
import { auth } from "@/auth";
import { getGoogleAccessToken } from "./auth-token";
import { listEventsInRange } from "./google-calendar";
import type { CalendarEvent } from "./calendar/layout";

function toLocalISO(d: Date, timeZone: string): string {
  const dt = DateTime.fromJSDate(d).setZone(timeZone);
  return dt.isValid ? dt.toISO({ suppressMilliseconds: true })! : d.toISOString();
}

export async function fetchCalendarWeek(
  weekStartISO: string,
  timeZone: string,
): Promise<{ ok: true; events: CalendarEvent[] } | { ok: false; error: string; needsSignIn?: boolean }> {
  const session = await auth();
  if (!session) return { ok: false, error: "Please sign in.", needsSignIn: true };
  const token = await getGoogleAccessToken();
  if (!token) return { ok: false, error: "Your session expired. Please sign in again.", needsSignIn: true };

  const start = DateTime.fromISO(weekStartISO, { zone: timeZone });
  const timeMin = (start.isValid ? start : DateTime.now().setZone(timeZone).startOf("week")).toISO()!;
  const timeMax = DateTime.fromISO(timeMin).plus({ days: 7 }).toISO()!;

  try {
    const events = await listEventsInRange(token, timeMin, timeMax);
    return {
      ok: true,
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        start: toLocalISO(e.start, timeZone),
        end: toLocalISO(e.end, timeZone),
        allDay: e.allDay,
        location: e.location,
        description: e.description,
      })),
    };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "AUTH_EXPIRED" || code === "SCOPE_DENIED")
      return { ok: false, error: "Your Google session or calendar permission needs a refresh. Please sign in again.", needsSignIn: true };
    return { ok: false, error: "Couldn't load your calendar. Please try again." };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/calendar-actions.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add lib/calendar-actions.ts lib/calendar-actions.test.ts
git commit -m "feat(web): fetchCalendarWeek server action (events in user tz)"
```

---

## Task 3: `WeekGrid` component + shadcn deps

**Files:** Create `components/WeekGrid.tsx`; add shadcn `dialog`, `alert-dialog`, `textarea`, `label`.

**Interfaces:**
- Consumes: `layoutDayEvents`/`CalendarEvent` (`@/lib/calendar/layout`), Luxon, `cn`, theme tokens.
- Produces: `WeekGrid({ weekDays, events, todayISODate, onEventClick, onSlotClick })` where `weekDays: DateTime[]` (7, Mon→Sun), `todayISODate: string` (e.g. `"2026-09-30"`), `onEventClick(event: CalendarEvent)`, `onSlotClick(dayISODate: string, hour: number)`.

- [ ] **Step 1: Add shadcn components**

```bash
npx shadcn@latest add dialog alert-dialog textarea label
```

Expected: files under `components/ui/`. If the CLI prompts, use `-y`/defaults; if it fails, add the components manually from the shadcn docs.

- [ ] **Step 2: Implement `components/WeekGrid.tsx`**

```tsx
"use client";
import { DateTime } from "luxon";
import { layoutDayEvents, type CalendarEvent } from "@/lib/calendar/layout";
import { cn } from "@/lib/utils";

const PX_PER_HOUR = 48;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

export function WeekGrid({ weekDays, events, todayISODate, onEventClick, onSlotClick }: {
  weekDays: DateTime[];
  events: CalendarEvent[];
  todayISODate: string;
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (dayISODate: string, hour: number) => void;
}) {
  const dayKey = (d: DateTime) => d.toISODate()!;
  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const d of weekDays) eventsByDay.set(dayKey(d), []);
  for (const e of events) {
    const key = e.start.slice(0, 10); // YYYY-MM-DD wall date
    if (eventsByDay.has(key)) eventsByDay.get(key)!.push(e);
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="grid" style={{ gridTemplateColumns: "44px repeat(7, minmax(0, 1fr))" }}>
        <div className="border-b" />
        {weekDays.map((d) => {
          const isToday = dayKey(d) === todayISODate;
          return (
            <div key={dayKey(d)} className="border-b border-l py-1.5 text-center text-xs text-muted-foreground">
              <div>{d.toFormat("ccc")}</div>
              <div className={cn("mx-auto mt-0.5 w-7 rounded-md text-sm", isToday ? "bg-primary text-primary-foreground" : "text-foreground")}>
                {d.day}
              </div>
            </div>
          );
        })}

        <div className="border-b py-1 pr-1 text-right text-[10px] text-muted-foreground">all-day</div>
        {weekDays.map((d) => {
          const allDay = (eventsByDay.get(dayKey(d)) ?? []).filter((e) => e.allDay);
          return (
            <div key={"ad-" + dayKey(d)} className="border-b border-l p-1 space-y-0.5">
              {allDay.map((e, i) => (
                <button key={i} onClick={() => onEventClick(e)}
                  className="block w-full truncate rounded-sm border-l-2 border-primary bg-primary/10 px-1.5 py-0.5 text-left text-[11px] text-primary">
                  {e.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <div className="max-h-[65vh] overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: "44px repeat(7, minmax(0, 1fr))" }}>
          <div className="relative" style={{ height: 24 * PX_PER_HOUR }}>
            {HOURS.map((h) => (
              <div key={h} className="absolute right-1 -translate-y-1/2 text-[10px] text-muted-foreground" style={{ top: h * PX_PER_HOUR }}>
                {h === 0 ? "" : `${h}:00`}
              </div>
            ))}
          </div>
          {weekDays.map((d) => {
            const positioned = layoutDayEvents(eventsByDay.get(dayKey(d)) ?? [], { pxPerHour: PX_PER_HOUR });
            return (
              <div key={"col-" + dayKey(d)} className="relative border-l" style={{ height: 24 * PX_PER_HOUR }}>
                {HOURS.map((h) => (
                  <button key={h} onClick={() => onSlotClick(dayKey(d), h)}
                    className="absolute inset-x-0 border-t border-border/60 hover:bg-muted/40"
                    style={{ top: h * PX_PER_HOUR, height: PX_PER_HOUR }} aria-label={`New event ${d.toFormat("ccc")} ${h}:00`} />
                ))}
                {positioned.map((p, i) => (
                  <button key={i} onClick={() => onEventClick(p.event)}
                    className="absolute overflow-hidden rounded-sm border-l-2 border-primary bg-primary/10 px-1.5 py-0.5 text-left text-[11px] text-primary hover:bg-primary/20"
                    style={{ top: p.top, height: p.height, left: `calc(${(p.laneIndex / p.laneCount) * 100}% + 2px)`, width: `calc(${100 / p.laneCount}% - 4px)` }}>
                    <span className="block truncate font-medium">{p.event.title}</span>
                    <span className="block truncate opacity-80">{p.event.start.slice(11, 16)}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` (clean) and `npx next build` (succeeds). `WeekGrid` isn't rendered yet (wired in Task 5); this task is additive.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(web): WeekGrid time-grid component + shadcn dialog deps"
```

---

## Task 4: `EventDialog` — create/edit form + delete confirm

**Files:** Create `components/EventDialog.tsx`.

**Interfaces:**
- Consumes: `executeWrite` (`@/lib/chat-actions`), `CalendarEvent` (`@/lib/calendar/layout`), Luxon, shadcn `Dialog`/`AlertDialog`/`Input`/`Textarea`/`Label`/`Button`.
- Produces: `EventDialog({ open, mode, initial, timeZone, onClose, onSaved })` where `mode: "create" | "edit"`, `initial: { event?: CalendarEvent; dayISODate?: string; hour?: number }`, `onSaved()` (parent refetches).

- [ ] **Step 1: Implement `components/EventDialog.tsx`**

```tsx
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
                  <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
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
```

> If the installed radix-nova `AlertDialogAction`/`Button` prop names differ, reconcile against the installed `components/ui/*` (tsc will flag). Keep the confirm/cancel behavior.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` (clean) and `npx next build` (succeeds). Not rendered yet (Task 5).

- [ ] **Step 3: Commit**

```bash
git add components/EventDialog.tsx
git commit -m "feat(web): EventDialog create/edit form + delete confirm"
```

---

## Task 5: `CalendarClient` + page + Header nav (wire it together)

**Files:** Create `components/CalendarClient.tsx`, `app/calendar/page.tsx`; Modify `components/Header.tsx`.

**Interfaces:**
- Consumes: `WeekGrid` (T3), `EventDialog` (T4), `fetchCalendarWeek` (T2), `CalendarEvent` (T1), Luxon, shadcn `Button`, `signIn` (`next-auth/react`), `Header`.

- [ ] **Step 1: Implement `components/CalendarClient.tsx`**

```tsx
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
        <EventDialog open mode={dialog.mode} timeZone={zone}
          initial={{ event: dialog.event, dayISODate: dialog.dayISODate, hour: dialog.hour }}
          onClose={() => setDialog(null)} onSaved={load} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the Calendar page `app/calendar/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignInButton } from "@/components/SignInButton";
import { SignOutButton } from "@/components/SignOutButton";
import { Header } from "@/components/Header";
import { CalendarClient } from "@/components/CalendarClient";

export default async function CalendarPage() {
  const session = await auth();
  if (!session) redirect("/");
  if (session.calendarGranted === false) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
        <h1 className="text-2xl font-medium">Calendar access needed</h1>
        <p className="text-muted-foreground">This app needs access to your Google Calendar. Please sign in again and allow it.</p>
        <SignInButton label="Sign in and allow access" />
        <SignOutButton />
      </main>
    );
  }
  return (
    <>
      <Header user={{ name: session.user?.name, email: session.user?.email, image: session.user?.image }} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-medium">Calendar</h1>
        <CalendarClient />
      </main>
    </>
  );
}
```

> Note: this page uses `max-w-5xl` (wider than the other pages' `max-w-3xl`) so the 7-column grid has room. That's intentional.

- [ ] **Step 3: Add the "Calendar" nav link in `components/Header.tsx`**

In the `NAV` array, add an entry so it reads:

```tsx
const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/calendar", label: "Calendar" },
  { href: "/assistant", label: "Assistant" },
];
```

(No other Header change.)

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` (clean), `npx vitest run` (all green — logic unchanged), `npx next build` (succeeds; `/calendar` listed). Then `npm run dev` and confirm `/calendar` renders the week grid with the nav, and the "Calendar" link appears in the header.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): calendar page — CalendarClient wiring + header nav"
```

---

## Task 6: Final verification & live-test

- [ ] **Step 1: Full gate**

```bash
npx tsc --noEmit
npx vitest run
npx next build
git grep -n "console.log" app components lib || echo clean
```

All must pass; grep prints "clean".

- [ ] **Step 2: Manual live-test (authed, requires the user)**

In the dev server, signed in:
1. `/calendar` shows the current week; your existing events appear at the right times (correct timezone), overlaps split side-by-side, all-day events in the top row.
2. ‹ / Today / › navigate weeks; the range label updates; a revisited week is instant (cached).
3. Click an empty slot → New-event form prefilled with that day/time → Save → the event appears.
4. Click an event → edit the time/title → Save → it moves/updates.
5. Click an event → Delete → confirm → it disappears (and is gone from Google Calendar).
6. Check light and dark, and that the header "Calendar" link is active on this page.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(web): calendar view polish"
```

(Skip if nothing needed fixing.)

---

## Self-Review

**Spec coverage:**
- Custom week time-grid (Mon start, full-day scrollable, today highlight, all-day row, overlaps) → Task 1 (math) + Task 3 (grid). ✓
- Positioning + overlap lanes isolated + tested → Task 1. ✓
- `fetchCalendarWeek` read action (events in user tz, needsSignIn) → Task 2. ✓
- Full CRUD via forms reusing `executeWrite`; delete confirm; no AI card → Task 4. ✓
- Per-week cache is NOT in the plan's CalendarClient (it refetches on week change) — **spec said cache per week; the plan refetches each navigation instead.** See note below.
- Calendar page + gate + Header nav → Task 5. ✓
- No change to google-calendar (`description` already mapped), chat/summaries/providers → constraints. ✓
- Gate + live test → Task 6. ✓

**Note (spec deviation, intentional, minimal):** the spec described a per-week client cache; the plan's `CalendarClient` refetches on each week change for simplicity (an LLM-free calendar read is fast and always-fresh is desirable after writes). If instant back-navigation matters, a `Record<weekStartISO, CalendarEvent[]>` cache can be added later — not worth the complexity now. This is a YAGNI simplification, flagged for the reviewer.

**Placeholder scan:** No TBD/TODO. The one reconciliation note (radix-nova AlertDialog/Button prop names) is a concrete "verify against installed types" instruction.

**Type consistency:** `CalendarEvent` (T1) is used by T2 (`fetchCalendarWeek` return), T3 (`WeekGrid` props), T4 (`EventDialog`), T5 (`CalendarClient`). `WeekGrid` props (T3) match the call in `CalendarClient` (T5). `EventDialog` props (T4) match its use in T5. `executeWrite` args match its signature. `fetchCalendarWeek(weekStartISO, timeZone)` (T2) matches its call in T5. Consistent.

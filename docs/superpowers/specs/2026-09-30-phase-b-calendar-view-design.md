# Phase B — Week Calendar View + Inline Event Management — Design

- **Date:** 2026-09-30
- **Status:** Approved design, pending implementation plan
- **Scope:** Web app (`web/`). Phase B of the redesign initiative.
- **Branch:** `phase-b-calendar` (off `main`, which has the migration + Phase A
  redesign + streaming chat).

## Problem

Users can only *read* their schedule as a text summary (dashboard) or *manage*
it through chat. There's no way to **see** the week visually or to
create/edit/delete events directly on a calendar.

## Goal

A **custom week time-grid** calendar view where the user can see their week and
do **full CRUD via forms** — click an event to edit/delete, click an empty slot
to create — reusing the existing Google Calendar CRUD. It matches the violet
theme + light/dark, with no calendar library.

## Non-goals / unchanged

- **No drag-and-drop** move/resize.
- **No month/day/agenda views** in this phase (week only; others are possible
  later).
- **No database** — events are fetched live per week, same statelessness as the
  rest of the app.
- **No AI confirm card on the calendar** — a direct form submission (and a
  delete confirmation) *is* the user's confirmation. The chat's AI-initiated
  confirm flow is untouched.
- No change to chat/streaming, summaries, providers, or auth.
- Editing "all occurrences" of a recurring event is out of scope (edits act on
  the single instance).

## Decisions (locked in brainstorming)

- **Week time-grid**, built **custom** (Tailwind + shadcn) — chosen over a
  library for theme fit, dark-mode, and React 19 / Tailwind v4 / Next 16
  compat.
- **Full CRUD via forms** (click event → edit/delete; click slot → create).
- **Reuse `executeWrite(tool, args)`** (from the streaming phase) as the single
  validated write path.
- Week starts **Monday** (ISO). Grid is **full-day (00:00–24:00), vertically
  scrollable**, auto-scrolled toward the morning / current time.
- Per-week results are **cached in client state**; a write re-fetches the
  affected week.

## Architecture

### Pages & components

- **`app/calendar/page.tsx`** (server component): `auth()` → redirect if no
  session; the `session.calendarGranted === false` gate (restyled, like the
  dashboard/assistant pages); renders `<Header user={…} />` + `<CalendarClient/>`.
- **`components/Header.tsx`** (modify): add a **"Calendar"** nav link (between
  Dashboard and Assistant), active-state aware.
- **`components/CalendarClient.tsx`** (client): owns the current week anchor
  (a Luxon `DateTime` at week start), the per-week event cache, and dialog
  state. Fetches the visible week via `fetchCalendarWeek`, renders `<WeekGrid/>`,
  and opens `<EventDialog/>` for create/edit and the delete confirm. Re-fetches
  the week after any successful write.
- **`components/WeekGrid.tsx`** (presentational client): props `{ weekDays:
  DateTime[], events: CalendarEvent[], onEventClick(event), onSlotClick(day,
  hour) }`. Renders: the nav bar (‹ / Today / › + week-range label), 7 day
  headers (today highlighted violet), an all-day row (all-day events as chips),
  and the hourly time grid with **timed events positioned by start/end** and
  **overlaps split side-by-side** (using `lib/calendar/layout.ts`). A "+ New
  event" affordance.
- **`components/EventDialog.tsx`** (client): a shadcn `Dialog` with the
  create/edit **form** (title, date, start time, end time, location,
  description) and, for existing events, a **Delete** action guarded by a shadcn
  `AlertDialog` ("Delete this event?"). On submit it calls the write action and
  reports success/error to `CalendarClient`.

### The tested core — `lib/calendar/layout.ts`

Pure, framework-free functions (this is where the real logic and the tests
live):

- `type PositionedEvent = { event: CalendarEvent; top: number; height: number; laneIndex: number; laneCount: number }`
- `layoutDayEvents(events: CalendarEvent[], opts: { pxPerHour: number }): PositionedEvent[]`
  - Filters to **timed** (non-all-day) events for that day.
  - `top = (minutesFromMidnight(start) / 60) * pxPerHour`; `height = max(minHeight,
    (durationMinutes / 60) * pxPerHour)`.
  - **Overlap lanes:** sort by start; assign each event the lowest free lane
    among events it overlaps in time; `laneCount` = the size of its overlap
    cluster, so the block's width is `100% / laneCount` and left offset is
    `laneIndex / laneCount`. Non-overlapping events get `laneIndex 0, laneCount 1`
    (full width).
- Small helpers as needed (e.g. `minutesFromMidnight`), kept pure.

The grid component consumes `PositionedEvent[]` and renders blocks with
`top/height` px and `left/width` percentages; no layout math in the component.

### Data flow

- **Read — `lib/calendar-actions.ts`** (new): `fetchCalendarWeek(weekStartISO:
  string, timeZone: string): Promise<{ ok: true; events: CalendarEvent[] } |
  { ok: false; error: string; needsSignIn?: boolean }>`. `auth()` +
  `getGoogleAccessToken()` guards, then `listEventsInRange(token, weekStartISO,
  weekEndISO)` for the 7-day window, mapping to a serializable
  **`CalendarEvent`** `{ id, title, start: ISO, end: ISO, allDay, location,
  description }`. Errors map to friendly messages + `needsSignIn`
  (AUTH_EXPIRED/SCOPE_DENIED), reusing `lib/ai/errors` where useful.
- **`mapGoogleEvent`** (`lib/google-calendar.ts`): add a `description` field if
  not already mapped (the edit form needs it). Small, additive.
- **Write:** reuse **`executeWrite`** (`lib/chat-actions.ts`): create →
  `executeWrite("create_event", { title, start, end, location?, description? })`;
  edit → `executeWrite("update_event", { eventId, title?, start?, end?, location?,
  description? })`; delete → `executeWrite("delete_event", { eventId })`. `start`/
  `end` are ISO-8601 with the user's offset (built from the form's date + time in
  `timeZone`). After a successful write, `CalendarClient` re-fetches the current
  week so the change appears.
- **Caching:** `CalendarClient` keeps a `Record<weekStartISO, CalendarEvent[] |
  loading | error>`-style cache; navigating to a cached week is instant, an
  uncached one shows a loading state; a write invalidates and refetches the
  current week.

## File structure

| File | Responsibility | New/Mod |
|------|----------------|---------|
| `app/calendar/page.tsx` | server page: gate + Header + CalendarClient | new |
| `components/CalendarClient.tsx` | week state, fetch, cache, dialog orchestration | new |
| `components/WeekGrid.tsx` | nav bar + headers + all-day row + time grid + event blocks | new |
| `components/EventDialog.tsx` | create/edit form + delete confirm | new |
| `lib/calendar/layout.ts` (+ `.test.ts`) | positioning + overlap-lane math | new |
| `lib/calendar-actions.ts` | `fetchCalendarWeek` server action | new |
| `components/Header.tsx` | add "Calendar" nav link | mod |
| `lib/google-calendar.ts` | add `description` to `mapGoogleEvent` | mod (small) |
| `components/ui/*` | add shadcn `dialog`, `alert-dialog`, `textarea`, `label` | add |

**Unchanged:** `executeWrite`/`validateWriteArgs`/`google-calendar` CRUD,
`lib/ai/*`, chat/streaming, summaries/dashboard, `auth.ts`.

## Testing

- **`lib/calendar/layout.ts`** (TDD): non-overlapping events get full width
  (laneCount 1); two events overlapping in time get laneCount 2 with
  laneIndex 0/1; a 3-way overlap gets laneCount 3; `top`/`height` computed from
  start/end and `pxPerHour`; a zero/short event gets `minHeight`; all-day events
  are excluded from the timed layout.
- **`fetchCalendarWeek`** (optional light test, mock `google-calendar`): returns
  mapped `CalendarEvent`s for the range; auth/token failure → `needsSignIn`.
- Presentational (`WeekGrid`, `EventDialog`, `CalendarClient`) verified by
  `tsc` + `next build` + a visual pass (light/dark; overlaps; create/edit/delete;
  week nav; empty week).
- `executeWrite` is already tested (streaming phase).
- Gate: `tsc --noEmit` clean → `vitest run` green → `next build` succeeds →
  manual authed live test (view the week, create via slot, edit, delete, nav).

## Risks / caveats

- **Overlap layout** is the trickiest logic — contained and tested in
  `layout.ts`.
- **Mobile:** a 7-column time grid is cramped on phones → the grid is
  **horizontally scrollable** (min column width) on small screens; a dedicated
  day view is a possible later add.
- **Timezone:** the form builds ISO datetimes with the user's offset (Luxon,
  `timeZone` from the client), consistent with how the chat produces write args;
  events are displayed in the user's zone.
- **Recurring events:** displayed as expanded instances; edit/delete affects the
  single instance only (documented limitation).
- **`executeWrite` reuse:** `create_event` exposes no attendees param (safety) —
  fine, the calendar form doesn't edit attendees.

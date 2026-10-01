# Unified Workspace — Design

- **Date:** 2026-10-01
- **Status:** Approved design, pending implementation plan
- **Scope:** Web app (`web/`).
- **Branch:** `unified-workspace` (off `main`). Built on a branch so the
  live site (`main` auto-deploys to Vercel) never shows a half-finished refactor.

## Problem

The signed-in app is three separate pages — Dashboard (AI summaries), Calendar
(week grid + CRUD), Assistant (chat). The core differentiator, managing the
calendar by talking to an AI, is quarantined on its own page: the user looks at
their schedule on one page, then leaves it to talk to the assistant elsewhere.
Summaries are a siloed, read-only third page. Every page hop is friction that
hides the value.

## Goal

One **calendar-centric workspace** at `/app`: the week calendar as the canvas,
a **context-aware chat docked beside it**, and an **auto-shown week brief** on
top — with the grid updating live when a chat action is confirmed. Retire the
standalone dashboard and assistant pages.

## Decisions (locked in brainstorming)

- Workspace lives at **`/app`** and is the post-sign-in home. `/dashboard`,
  `/assistant`, and `/calendar` **redirect** to `/app`; the signed-in redirect
  from `/` goes to `/app`.
- Header nav **collapses** to brand + theme toggle + account menu (one page now).
- **Desktop:** calendar fills the space, chat **docked on the right** (~380px),
  with a toggle to collapse the dock for a full-width calendar.
- **Mobile:** calendar is primary; chat opens as a **slide-up sheet** from a
  button (can't fit side-by-side on a phone).
- **Brief is auto-shown**: a compact one-line brief of the viewed week sits on
  top, expandable to the full Day/Week/Month summary. Reuses the existing
  summary pipeline. The standalone dashboard goes away.
- **Context-aware chat:** the chat is told which week is on screen (and the day
  the user clicks), so "this week" / "clear this afternoon" resolve to the view.
  "today" stays the actual current date.
- **Live updates:** the workspace owns the week's events; a confirmed chat write
  refetches the visible week so the change appears on the grid.
- **Reuse, not rebuild:** `WeekGrid`, `EventDialog`, the chat engine
  (`/api/chat` + confirm flow), and the summary pipeline (`generateSummary` +
  `SummaryView`) are reused; this is a new shell that composes them.

## Architecture

### Route & shell

- **`app/app/page.tsx`** (server, new): `auth()` gate + `calendarGranted` gate
  (same as current pages) + `<Header/>` + `<WorkspaceClient/>`.
- **Redirects:** `app/dashboard/page.tsx`, `app/assistant/page.tsx`,
  `app/calendar/page.tsx` become `redirect("/app")`. `app/page.tsx`'s signed-in
  branch redirects to `/app` (was `/dashboard`).
- **`components/Header.tsx`** (mod): drop the Dashboard/Calendar/Assistant nav;
  keep the brand (links to `/app`), `ThemeToggle`, and the account dropdown.

### WorkspaceClient (new, client)

Owns the shared state that the calendar and the chat both need:

- Week anchor (Luxon, Monday start), the week's events, loading/error, the
  event dialog state, and a `selectedDayISO` focus.
- `reloadWeek()` — refetches the visible week via `fetchCalendarWeek`; passed to
  the chat so a confirmed write refreshes the grid.
- Layout: on `lg+`, a two-column grid (calendar `flex-1` + chat dock ~380px with
  a collapse toggle); below `lg`, calendar full-width with an "Ask Cadence"
  button that opens the chat in a `Sheet`.
- Hosts `BriefBar` on top, `WeekGrid` + `EventDialog` in the main column, and the
  chat in the dock/sheet.

The current `CalendarClient` logic (anchor, fetch, nav, dialog, date picker)
moves into `WorkspaceClient`; `CalendarClient` is retired.

### BriefBar (new, client)

- Auto-fetches the **weekly** summary for the viewed week (`generateSummary`,
  `period: "weekly"`, `date: anchor`, `zone`) and shows a one-liner
  (overview + "Nh · N events").
- A "Brief ▾" toggle expands to the full `SummaryView` with Day / Week / Month,
  reusing the `summary-state` reducer/cache so toggling periods doesn't refetch.
- Re-briefs when the week changes.

### Context-aware chat

- `ChatClient` (mod) takes `viewContext` (`{ weekStartISO, selectedDayISO? }`)
  and an `onWriteComplete` callback. The context rides the transport body
  alongside `timeZone` (so every request, including the post-confirm resend,
  carries it). After a confirmed write it calls `onWriteComplete()` →
  `reloadWeek()`.
- **`app/api/chat/route.ts`** (mod): read `viewContext` from the body and pass
  it to `buildSystem`.
- **`lib/chat/system.ts`** (mod): add a line like "The user is currently viewing
  the week of <Mon d – Sun d>; interpret 'this week' as that week. 'today' is
  still the actual current date." Clicking a day sets `selectedDayISO`, surfaced
  as a subtle "focused on <day>" hint and used to fill an unspecified day.

### Mobile

- Add shadcn **`Sheet`** (`components/ui/sheet.tsx`) for the slide-up chat.
- A floating "Ask Cadence" button (bottom-right) opens it; the dock content and
  the sheet content are the same `ChatClient`.

## File structure

| File | Responsibility | New/Mod |
|------|----------------|---------|
| `app/app/page.tsx` | server gate + Header + WorkspaceClient | new |
| `components/WorkspaceClient.tsx` | shell: week state, layout, live reload, hosts all | new |
| `components/BriefBar.tsx` | auto week brief + expandable full summary | new |
| `components/ChatClient.tsx` | accept viewContext + onWriteComplete | mod |
| `app/api/chat/route.ts` | read viewContext → buildSystem | mod |
| `lib/chat/system.ts` | include the viewed-week context | mod |
| `components/Header.tsx` | collapse nav to brand + account | mod |
| `app/page.tsx` | signed-in redirect → `/app` | mod |
| `app/{dashboard,assistant,calendar}/page.tsx` | redirect to `/app` | mod |
| `components/ui/sheet.tsx` | shadcn Sheet for mobile chat | add |
| `components/CalendarClient.tsx` / `DashboardClient.tsx` | logic absorbed into workspace / brief | retire |

**Unchanged:** `WeekGrid`, `EventDialog`, `SummaryView`, `executeWrite` +
confirm flow, `fetchCalendarWeek`, `generateSummary`, `lib/ai/*`, auth.

## Testing

- All existing lib tests stay green (no engine changes).
- New components (`WorkspaceClient`, `BriefBar`) verified by `tsc` + `next build`
  + a visual pass (desktop two-column, mobile sheet, live update after a chat
  write, light/dark).
- A small test that `buildSystem` includes the viewed-week line when context is
  passed.
- Gate: `tsc --noEmit` clean → `vitest run` green → `next build` succeeds →
  authed live test.

## Risks / caveats

- **Shared state** between chat and grid — kept in `WorkspaceClient`; the chat
  calls back on write completion rather than owning calendar state.
- **Prompt ambiguity** ("today" vs the viewed week) — explicit wording, with the
  actual current date kept authoritative.
- **Mobile layout** (sheet + floating button) is the fiddliest piece.
- **Scope** — phased into tasks in the plan; reuse keeps each task small.

## Non-goals

- No drag-and-drop, no month/day *grid* views (the brief covers month/day
  *summaries*), no new AI capabilities, no change to the confirm/safety model.

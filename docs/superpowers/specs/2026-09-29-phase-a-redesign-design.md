# Phase A — Redesign + Design System (shadcn / Vivid Focus) — Design

- **Date:** 2026-09-29
- **Status:** Approved design, pending implementation plan
- **Scope:** Web app (`web/`). Phase A of the "full redesign + features" initiative.
- **Related:** later phases (own specs) — Streaming chat, Calendar view (Phase B),
  Database/persistence (Phase C). This spec covers **none** of those.

## Problem

The app works but looks like the default Next.js starter: Geist font, a bare
`--background`/`--foreground` theme, components hand-styled with inline Tailwind.
It reads as a prototype, not a portfolio piece.

## Goal

A cohesive visual redesign built on **shadcn/ui**, in the approved **"Vivid
focus"** direction (confident violet accent, modern AI-product feel), with full
**light/dark** support — plus one low-risk feature: the dashboard summary
**auto-generates on load** (no "Summarize" button).

The app's *logic* does not change: the chat server actions, the human-in-the-loop
write-confirmation flow, and the summarize engine are untouched. This is a
presentation + one-feature phase.

## Non-goals (explicitly deferred)

- **Streaming chat** — rearchitects the chat data flow (server actions → route
  handler + `useChat` + client-side tool confirmation). Its own later phase.
- **Calendar / agenda view** and **inline event management** — Phase B.
- **Database / persisted history** — Phase C.
- No change to auth, Google Calendar integration, the orchestrator, tools,
  schemas, or the provider layer.

## Decisions (locked in brainstorming)

- Visual direction: **Vivid focus** — violet primary (~`#534AB7`), subtle accent
  tints, `--radius` 12px.
- Component system: **shadcn/ui**, **"new-york"** style, on **Tailwind v4**
  (CSS-variable theming via `@theme inline`, which `globals.css` already uses).
- **Dark mode:** `next-themes`, visible toggle in the nav, **defaults to the
  user's system preference**.
- Fonts: keep **Geist** everywhere; hierarchy by size/weight. Icons:
  **lucide-react**. Class utility: **`cn()`** (clsx + tailwind-merge).
- Chat stays on its current **server-action + confirm-card** architecture;
  only its presentation changes.

## Architecture

### 1. Design system & theme

- Run shadcn init (see Build approach for the Next 16 / Tailwind v4 / React 19
  compatibility handling). Produces `components.json`, `lib/utils.ts` (`cn`), and
  `components/ui/*`.
- **Theme tokens** in `app/globals.css`, defined for both light and dark: the
  shadcn token set — `--background`, `--foreground`, `--card`,
  `--card-foreground`, `--popover`, `--primary` (violet), `--primary-foreground`,
  `--secondary`, `--muted`, `--muted-foreground`, `--accent`, `--border`,
  `--input`, `--ring`, `--destructive`, `--radius`. Tailwind v4 exposes these via
  `@theme inline`.
- **`ThemeProvider`** (`next-themes`) wraps the app in `layout.tsx`
  (`attribute="class"`, `defaultTheme="system"`, `enableSystem`).

### 2. App shell & navigation

- **`Header`** component (client), shown on authenticated pages: app mark + name
  on the left; nav links **Dashboard** and **Assistant** (active state); on the
  right a **`ThemeToggle`** and a **user avatar `DropdownMenu`** (shows email,
  **Sign out**). Built from shadcn `Button`, `Avatar`, `DropdownMenu`,
  `lucide-react` icons.
- The **landing** page (signed-out) renders its own minimal layout — no app nav.
- Responsive: on mobile the header collapses (nav links move into a menu / the
  layout stacks); no separate mobile spec beyond "works at phone width."

### 3. Screens

**Landing (`/`)** — signed-out (redirects to `/dashboard` when authed):
- Hero: app mark, headline ("Your calendar, summarized"), one-line value prop, a
  primary **Continue with Google** button (existing `SignInButton`, restyled).
- A responsive row of **3 feature cards** describing what exists: smart
  daily/weekly/monthly summaries · a chat assistant that creates/edits events
  with confirmation · free and private (multi-provider, no data resale).
- Vivid theme, dark-mode aware.

**Dashboard (`/dashboard`)** — the auto-summary home:
- Period selector as **tabs**: Day / Week / Month. No "Summarize" button.
- **Auto-summary on load (client-fetch, not server-blocking):** the dashboard's
  client component calls the existing `generateSummary` server action on mount
  for the default period. The page paints immediately with a **skeleton**; the
  summary fills in when ready. Rationale: an LLM call takes 2–7s; server-blocking
  render would show a blank page for seconds.
- **Per-period cache:** results are cached in component state keyed by period
  (`Record<Period, Summary>`). Switching to an already-loaded period is instant
  and does not re-call the model (saves quota). Switching to an unloaded period
  shows the skeleton and fetches.
- Presentation: a `Card` with the overview lead text, a **metric row**
  (scheduled hours · number of events) as tiles, the key-events list, and
  highlights as `Badge`s.
- Errors: `generateSummary` already returns friendly messages and a
  `needsSignIn` flag; render them inline as a shadcn **`Alert`** (with a sign-in
  action when `needsSignIn`).
- Empty period: the engine's empty summary ("Nothing scheduled…") renders as a
  quiet empty state.

**Assistant (`/assistant`)** — chat, restyled only, **no behavior change**:
- Message list of user/assistant bubbles (violet for the user, muted surface for
  the assistant), inside a **`ScrollArea`**.
- The **confirm card** becomes a shadcn `Card`: the `summarizeWrite` line, a
  violet **Confirm** (primary) and a ghost **Cancel**, disabled while busy.
- Input row: shadcn `Input` + primary send `Button`; disabled while busy or while
  a confirm is pending (as today).
- States: empty ("Ask about your schedule…"), **Thinking…**, and error `Alert`.
- The client keeps calling `sendChatMessage` / `confirmWrite` / `declineWrite`
  and storing the `ModelMessage[]` history exactly as now.

### 4. Build approach

- **First task de-risks the stack.** Verify `npx shadcn@latest init` succeeds on
  **Next 16 + Tailwind v4 + React 19**. If the CLI fails or misconfigures, fall
  back to **manual setup**: install deps (`class-variance-authority`, `clsx`,
  `tailwind-merge`, `lucide-react`, `next-themes`, `tw-animate-css` or the
  Tailwind-v4 animation equivalent, and the Radix packages per component), create
  `components.json`, add the token block to `globals.css`, add `lib/utils.ts`,
  and add component source under `components/ui/`. Record which path was taken.
- **shadcn components used:** button, card, input, tabs, dropdown-menu, avatar,
  badge, skeleton, alert, scroll-area, separator.
- **Files created/changed:**
  - `app/globals.css` — theme tokens (light + dark), `@theme inline` mapping.
  - `lib/utils.ts` — `cn`.
  - `components/ui/*` — shadcn primitives.
  - `app/layout.tsx` — `ThemeProvider`; body uses theme tokens.
  - `components/Header.tsx`, `components/ThemeToggle.tsx` — new.
  - `components/ThemeProvider.tsx` — `next-themes` wrapper (client).
  - Restyled: `ChatClient.tsx`, `ConfirmWriteCard.tsx`, `DashboardClient.tsx`,
    `SummaryView.tsx`, `PeriodSelector.tsx`, `SignInButton.tsx`,
    `SignOutButton.tsx`, `app/page.tsx` (landing), `app/dashboard/page.tsx`,
    `app/assistant/page.tsx`.
  - `package.json` — new UI deps.
- **Logic untouched:** `lib/chat/*`, `lib/chat-actions.ts`, `lib/actions.ts`,
  `lib/engine/*`, `lib/ai/*`, `lib/google-calendar.ts`, `auth.ts`.

## Testing

- All **existing unit tests stay green** (engine, chat orchestrator, schemas,
  provider, errors, tools, google-calendar) — no logic changes.
- **New logic to test:** the dashboard's per-period cache behavior — a focused
  test that switching to a cached period does not re-invoke `generateSummary`,
  and switching to an uncached period does. Extract the cache/fetch logic so it
  is testable without rendering (e.g. a small hook or reducer).
- Presentational markup is **not** unit-tested exhaustively; correctness is
  verified by `tsc`, `next build`, and a visual pass in both light and dark mode.
- Gate: `tsc --noEmit` clean → `vitest run` all green → `next build` succeeds →
  manual visual check of landing, dashboard (loading/loaded/error/empty), and
  assistant (empty/thinking/reply/confirm) in light and dark.

## Risks / caveats

- **shadcn on Next 16 / Tailwind v4 / React 19** is the main unknown — handled by
  the de-risking first task with a manual-setup fallback.
- **Dashboard becomes client-driven** for the summary. The `generateSummary`
  server action already handles auth/quota/errors; the client just orchestrates
  fetch + cache + states. Confirm the existing action signature is convenient to
  call on mount and on period change.
- **Per-period cache is in-memory** (lost on full reload). That is acceptable for
  Phase A (no DB). `sessionStorage` persistence is a possible nicety, explicitly
  out of scope here.
- **No behavior change to chat** — the redesign must not alter the confirm flow,
  the message wire format, or the server actions. Restyle the markup only.

## Out of scope (restated)

Streaming chat, calendar/agenda view, inline event management, and any database
or persistence. Each is a later phase with its own spec.

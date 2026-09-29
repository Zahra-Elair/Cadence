# Phase A Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the web app on shadcn/ui in the "Vivid focus" violet direction with light/dark support, and make the dashboard summary auto-generate on load — without changing any chat, confirm-flow, or engine logic.

**Architecture:** Add shadcn/ui + a violet theme + `next-themes` on the existing Tailwind v4 setup. Introduce a shared app shell (Header + theme toggle), redesign landing / dashboard / assistant with shadcn primitives. The dashboard becomes client-driven: it auto-fetches the summary for the selected period on mount and caches results per period (a small tested reducer). All server actions, orchestrator, tools, and the summarize engine are untouched.

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, TypeScript strict, Tailwind v4, shadcn/ui ("new-york"), next-themes, lucide-react, Luxon, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-29-phase-a-redesign-design.md` (read it alongside this plan).

## Global Constraints

- **Visual direction:** "Vivid focus" — violet primary (~`#534AB7`), `--radius` 12px (`0.75rem`).
- **shadcn style:** "new-york". **Dark mode:** `next-themes`, `attribute="class"`, `defaultTheme="system"`, `enableSystem`; visible toggle in the nav.
- **Fonts:** keep Geist (already wired). **Icons:** lucide-react. **Class util:** `cn()` from `@/lib/utils`.
- **No logic changes.** Do not touch `lib/chat/*`, `lib/chat-actions.ts`, `lib/actions.ts`, `lib/engine/*` (except reading types), `lib/ai/*`, `lib/google-calendar.ts`, `auth.ts`. All existing unit tests must stay green.
- **Chat is restyle-only** — same `sendChatMessage` / `confirmWrite` / `declineWrite` calls, same `ModelMessage[]` history, same confirm-card behavior.
- **TypeScript strict.** Every task ends `tsc --noEmit` clean and `next build` succeeding; the summary-cache task also ends `vitest` green. Sentence case for UI copy; no em-dash-free rule — match existing tone.
- **Per `web/AGENTS.md`:** skim `node_modules/next/dist/docs/` before writing server-component/action code; never remove the auto-generated AGENTS.md block.
- All paths are relative to `web/`.

## Notes carried from exploring the code

- `Period = "daily" | "weekly" | "monthly"` (`lib/engine/types`). `Summary = { period, start, end, overview, keyEvents: string[], timeBreakdown: string, highlights: string[], empty: boolean }`.
- `generateSummary(input: { period: Period; date: string; zone: string }): Promise<{ ok: true; summary: Summary } | { ok: false; error: string; needsSignIn?: boolean }>` (`lib/actions.ts`) — unchanged, called from the client.
- The current per-page inline headers (name + nav link + SignOutButton) in `app/dashboard/page.tsx` and `app/assistant/page.tsx` are replaced by the shared `Header`. Both pages keep their `session.calendarGranted === false` gate (restyled).
- **The manual date picker is dropped** — the dashboard always summarizes the current day/week/month (`date = today`). Browsing other dates is out of scope.
- `PeriodSelector.tsx` is **deleted** — replaced by shadcn `Tabs` inside `DashboardClient`.

---

## File Structure

| File | Responsibility | Task |
|------|----------------|------|
| `components.json`, `lib/utils.ts`, `components/ui/*` | shadcn setup + primitives | 1 |
| `app/globals.css` | violet theme tokens (light/dark) | 1 |
| `components/ThemeProvider.tsx` | next-themes wrapper | 1 |
| `app/layout.tsx` | wrap in ThemeProvider | 1 |
| `components/ThemeToggle.tsx` | light/dark toggle | 2 |
| `components/Header.tsx` | app shell header | 2 |
| `components/SignOutButton.tsx` | restyle (used in header menu) | 2 |
| `app/page.tsx`, `components/SignInButton.tsx` | landing redesign | 3 |
| `lib/dashboard/summary-state.ts` (+ test) | per-period cache reducer | 4 |
| `components/DashboardClient.tsx` | auto-fetch + cache + tabs + states | 5 |
| `components/SummaryView.tsx` | restyle + metric tiles | 5 |
| `app/dashboard/page.tsx` | Header + gate restyle | 5 |
| `components/PeriodSelector.tsx` | **delete** | 5 |
| `components/ChatClient.tsx`, `components/ConfirmWriteCard.tsx` | restyle | 6 |
| `app/assistant/page.tsx` | Header + gate restyle | 6 |

---

## Task 1: Foundation — shadcn, violet theme, next-themes

**Files:** Create `components.json`, `lib/utils.ts`, `components/ui/*`, `components/ThemeProvider.tsx`; Modify `app/globals.css`, `app/layout.tsx`, `package.json`.

**Interfaces:**
- Produces: `cn(...classes)` from `@/lib/utils`; shadcn components under `@/components/ui/*`; `ThemeProvider` (client) from `@/components/ThemeProvider`; a violet light/dark theme in `globals.css`.

- [ ] **Step 1: Initialize shadcn (de-risk the stack)**

Run (from `web/`):

```bash
npx shadcn@latest init -d -b neutral
```

`-d` uses defaults (new-york, CSS variables); `-b neutral` sets the neutral base. Expected: it creates `components.json`, `lib/utils.ts` (`cn`), updates `app/globals.css` with the Tailwind-v4 token block (including `@custom-variant dark (&:is(.dark *))`), and installs `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `tw-animate-css`.

**If the CLI fails or misconfigures on Next 16 / Tailwind v4 / React 19**, do the manual setup from https://ui.shadcn.com/docs/installation/manual: install those five deps, create `components.json` (style `new-york`, tailwind v4, base `neutral`, `rsc: true`, aliases `@/components`, `@/lib/utils`), add `lib/utils.ts` with `cn`, and paste the Tailwind-v4 `globals.css` token block from https://ui.shadcn.com/docs/tailwind-v4. Record in the report which path you took.

- [ ] **Step 2: Add the shadcn components this phase uses**

```bash
npx shadcn@latest add button card input tabs dropdown-menu avatar badge skeleton alert scroll-area separator
```

Expected: files under `components/ui/`. If a component pulls a peer dep, let the CLI install it.

- [ ] **Step 3: Install next-themes**

```bash
npm install next-themes
```

- [ ] **Step 4: Apply the violet primary override**

The init wrote a neutral (near-black) `--primary`. Edit `app/globals.css` so the primary is violet in both modes. In the `:root` block set:

```css
  --primary: oklch(0.50 0.17 283);
  --primary-foreground: oklch(0.98 0.01 283);
  --ring: oklch(0.50 0.17 283);
```

and in the `.dark` block set:

```css
  --primary: oklch(0.64 0.17 283);
  --primary-foreground: oklch(0.98 0.01 283);
  --ring: oklch(0.64 0.17 283);
```

Leave the other tokens as generated. (These approximate `#534AB7`; fine-tune the lightness if it reads too dark/bright, keeping hue 283.)

- [ ] **Step 5: Create the ThemeProvider**

Create `components/ThemeProvider.tsx`:

```tsx
"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

- [ ] **Step 6: Wrap the app in `app/layout.tsx`**

Keep the Geist font setup and metadata. Change the body to use theme tokens and wrap children:

```tsx
import { ThemeProvider } from "@/components/ThemeProvider";
// ...existing imports (Geist, metadata) unchanged...

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

(`suppressHydrationWarning` on `<html>` is required by next-themes. Remove the old `font-family: Arial` rule from `globals.css` if the init left it; the body now uses `font-sans` → Geist.)

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit` (clean) and `npx next build` (succeeds). Then `npm run dev` and confirm the existing pages still render and that toggling your OS light/dark flips the background (system default). No component conversion yet — this is the foundation.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(web): shadcn + violet theme + next-themes foundation"
```

---

## Task 2: App shell — Header + theme toggle

**Files:** Create `components/ThemeToggle.tsx`, `components/Header.tsx`; Modify `components/SignOutButton.tsx`. (Header is wired into the pages in Tasks 5–6, but build it here.)

**Interfaces:**
- Consumes: `cn`, `@/components/ui/{button,dropdown-menu,avatar}`, `next-themes`, `lucide-react`.
- Produces: `ThemeToggle` (client, no props); `Header({ user }: { user: { name?: string | null; email?: string | null; image?: string | null } })` (client); restyled `SignOutButton`.

- [ ] **Step 1: ThemeToggle**

Create `components/ThemeToggle.tsx`:

```tsx
"use client";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <Button variant="ghost" size="icon" aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}>
      <Sun className="h-5 w-5 hidden dark:block" />
      <Moon className="h-5 w-5 block dark:hidden" />
    </Button>
  );
}
```

- [ ] **Step 2: Restyle SignOutButton**

Rewrite `components/SignOutButton.tsx` to a full-width menu-friendly button using the server-action form (keep the `signOut` action):

```tsx
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form className={className} action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
      <Button type="submit" variant="ghost" className="w-full justify-start px-2">Sign out</Button>
    </form>
  );
}
```

- [ ] **Step 3: Header**

Create `components/Header.tsx`:

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "./ThemeToggle";
import { SignOutButton } from "./SignOutButton";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/assistant", label: "Assistant" },
];

export function Header({ user }: { user: { name?: string | null; email?: string | null; image?: string | null } }) {
  const pathname = usePathname();
  const initials = (user.name ?? user.email ?? "?").slice(0, 1).toUpperCase();
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 font-medium">
          <CalendarClock className="h-5 w-5 text-primary" />
          <span>Calendar Summarizer</span>
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={cn("rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground",
                pathname === n.href && "bg-muted text-foreground")}>
              {n.label}
            </Link>
          ))}
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger className="ml-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="h-8 w-8">
                {user.image ? <AvatarImage src={user.image} alt="" /> : null}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="max-w-[200px] truncate font-normal text-muted-foreground">
                {user.email ?? user.name}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <SignOutButton />
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` (clean) and `npx next build` (succeeds). The Header isn't rendered anywhere yet (wired in Tasks 5–6); this task just builds and type-checks the shell components.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): app shell header, theme toggle, restyled sign-out"
```

---

## Task 3: Landing page redesign

**Files:** Modify `app/page.tsx`, `components/SignInButton.tsx`.

**Interfaces:**
- Consumes: `@/components/ui/{button,card}`, `lucide-react`, `auth`, existing `signIn` server action.
- Produces: redesigned landing; `SignInButton` restyled (still a server-action form).

- [ ] **Step 1: Restyle SignInButton**

Rewrite `components/SignInButton.tsx`:

```tsx
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export function SignInButton({ label = "Continue with Google" }: { label?: string }) {
  return (
    <form action={async () => { "use server"; await signIn("google", { redirectTo: "/dashboard" }); }}>
      <Button type="submit" size="lg">{label}</Button>
    </form>
  );
}
```

- [ ] **Step 2: Redesign the landing page**

Rewrite `app/page.tsx` (keep the auth redirect):

```tsx
import { redirect } from "next/navigation";
import { CalendarClock, MessageSquareText, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { SignInButton } from "@/components/SignInButton";
import { Card, CardContent } from "@/components/ui/card";

const FEATURES = [
  { icon: CalendarClock, title: "Smart summaries", body: "Daily, weekly, and monthly overviews of your calendar, written for you." },
  { icon: MessageSquareText, title: "Chat to manage events", body: "Create, move, and delete events in plain language — every change is confirmed first." },
  { icon: ShieldCheck, title: "Free and private", body: "Runs on free AI providers you choose. Your calendar isn't sold or mined." },
];

export default async function Home() {
  const session = await auth();
  if (session) redirect("/dashboard");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-10 px-4 py-16 text-center">
      <div className="flex flex-col items-center gap-5">
        <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm text-muted-foreground">
          <CalendarClock className="h-4 w-4 text-primary" /> Calendar Summarizer
        </span>
        <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">Your calendar, summarized.</h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          AI summaries of your Google Calendar and a chat assistant that manages your events — with a confirmation step before anything changes.
        </p>
        <SignInButton />
      </div>
      <div className="grid w-full gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <Card key={f.title} className="text-left">
            <CardContent className="flex flex-col gap-2 p-5">
              <f.icon className="h-5 w-5 text-primary" />
              <p className="font-medium">{f.title}</p>
              <p className="text-sm text-muted-foreground">{f.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` and `npx next build`. Then `npm run dev`, open `/` signed-out, and confirm the hero + 3 cards render in both light and dark (toggle your OS theme).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(web): redesign landing page"
```

---

## Task 4: Auto-summary per-period cache (TDD)

**Files:** Create `lib/dashboard/summary-state.ts`, `lib/dashboard/summary-state.test.ts`.

**Interfaces:**
- Consumes: `Period`, `Summary` from `@/lib/engine/types`.
- Produces:
  - `type Cell = { status: "loading" } | { status: "loaded"; summary: Summary } | { status: "error"; error: string; needsSignIn: boolean }`
  - `interface SummaryState { period: Period; byPeriod: Partial<Record<Period, Cell>> }`
  - `type SummaryAction = { type: "select"; period: Period } | { type: "loading"; period: Period } | { type: "loaded"; period: Period; summary: Summary } | { type: "error"; period: Period; error: string; needsSignIn: boolean }`
  - `initialSummaryState(period: Period): SummaryState`
  - `summaryReducer(state: SummaryState, action: SummaryAction): SummaryState`
  - `shouldFetch(state: SummaryState, period: Period): boolean` — true when that period has no cell or its cell is an error (so errors retry, successes don't).

- [ ] **Step 1: Write the failing test**

Create `lib/dashboard/summary-state.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { initialSummaryState, summaryReducer, shouldFetch } from "./summary-state";
import type { Summary } from "@/lib/engine/types";

const sum = (overview: string): Summary => ({
  period: "weekly", start: "s", end: "e", overview, keyEvents: [], timeBreakdown: "1h", highlights: [], empty: false,
});

describe("summary-state", () => {
  it("starts on the given period with an empty cache and wants a fetch", () => {
    const s = initialSummaryState("weekly");
    expect(s.period).toBe("weekly");
    expect(shouldFetch(s, "weekly")).toBe(true);
  });

  it("caches a loaded summary and no longer wants a fetch for it", () => {
    let s = initialSummaryState("weekly");
    s = summaryReducer(s, { type: "loading", period: "weekly" });
    s = summaryReducer(s, { type: "loaded", period: "weekly", summary: sum("Busy week") });
    expect(shouldFetch(s, "weekly")).toBe(false);
    const cell = s.byPeriod.weekly!;
    expect(cell.status === "loaded" && cell.summary.overview).toBe("Busy week");
  });

  it("wants a fetch for an uncached period even when another is loaded", () => {
    let s = initialSummaryState("weekly");
    s = summaryReducer(s, { type: "loaded", period: "weekly", summary: sum("x") });
    s = summaryReducer(s, { type: "select", period: "daily" });
    expect(s.period).toBe("daily");
    expect(shouldFetch(s, "daily")).toBe(true);
    expect(shouldFetch(s, "weekly")).toBe(false);
  });

  it("retries after an error (error cell still wants a fetch)", () => {
    let s = initialSummaryState("monthly");
    s = summaryReducer(s, { type: "error", period: "monthly", error: "boom", needsSignIn: false });
    expect(shouldFetch(s, "monthly")).toBe(true);
    const cell = s.byPeriod.monthly!;
    expect(cell.status).toBe("error");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/dashboard/summary-state.test.ts`
Expected: FAIL — cannot find module `./summary-state`.

- [ ] **Step 3: Implement `lib/dashboard/summary-state.ts`**

```ts
import type { Period, Summary } from "@/lib/engine/types";

export type Cell =
  | { status: "loading" }
  | { status: "loaded"; summary: Summary }
  | { status: "error"; error: string; needsSignIn: boolean };

export interface SummaryState {
  period: Period;
  byPeriod: Partial<Record<Period, Cell>>;
}

export type SummaryAction =
  | { type: "select"; period: Period }
  | { type: "loading"; period: Period }
  | { type: "loaded"; period: Period; summary: Summary }
  | { type: "error"; period: Period; error: string; needsSignIn: boolean };

export function initialSummaryState(period: Period): SummaryState {
  return { period, byPeriod: {} };
}

export function summaryReducer(state: SummaryState, action: SummaryAction): SummaryState {
  switch (action.type) {
    case "select":
      return { ...state, period: action.period };
    case "loading":
      return { ...state, byPeriod: { ...state.byPeriod, [action.period]: { status: "loading" } } };
    case "loaded":
      return { ...state, byPeriod: { ...state.byPeriod, [action.period]: { status: "loaded", summary: action.summary } } };
    case "error":
      return { ...state, byPeriod: { ...state.byPeriod, [action.period]: { status: "error", error: action.error, needsSignIn: action.needsSignIn } } };
    default:
      return state;
  }
}

/** Fetch when the period is uncached or its last attempt errored (so errors retry, successes stay cached). */
export function shouldFetch(state: SummaryState, period: Period): boolean {
  const cell = state.byPeriod[period];
  return cell === undefined || cell.status === "error";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/dashboard/summary-state.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/summary-state.ts lib/dashboard/summary-state.test.ts
git commit -m "feat(web): tested per-period summary cache reducer"
```

---

## Task 5: Dashboard UI — auto-summary, tabs, states

**Files:** Rewrite `components/DashboardClient.tsx`, `components/SummaryView.tsx`; Modify `app/dashboard/page.tsx`; Delete `components/PeriodSelector.tsx`.

**Interfaces:**
- Consumes: `summary-state` (Task 4), `generateSummary` (`@/lib/actions`), `@/components/ui/{tabs,card,skeleton,alert,badge,button}`, `Header` (Task 2), `Period`/`Summary` types, Luxon, `signIn` from `next-auth/react`.

- [ ] **Step 1: Rewrite SummaryView (metric tiles + restyle)**

Rewrite `components/SummaryView.tsx`:

```tsx
import type { Summary } from "@/lib/engine/types";
import { Badge } from "@/components/ui/badge";

export function SummaryView({ summary }: { summary: Summary }) {
  return (
    <div className="space-y-5">
      <p className="text-lg leading-relaxed">{summary.overview}</p>
      <div className="grid grid-cols-2 gap-3">
        <Metric label="Scheduled" value={summary.timeBreakdown} />
        <Metric label="Key events" value={String(summary.keyEvents.length)} />
      </div>
      <Section title="Key events" items={summary.keyEvents} />
      {summary.highlights.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Highlights</h3>
          <div className="flex flex-wrap gap-2">
            {summary.highlights.map((h, i) => <Badge key={i} variant="secondary">{h}</Badge>)}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-medium">{value}</p>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite DashboardClient (auto-fetch + cache + tabs + states)**

Rewrite `components/DashboardClient.tsx`:

```tsx
"use client";
import { useEffect, useReducer } from "react";
import { DateTime } from "luxon";
import { signIn } from "next-auth/react";
import type { Period } from "@/lib/engine/types";
import { generateSummary } from "@/lib/actions";
import { initialSummaryState, summaryReducer, shouldFetch } from "@/lib/dashboard/summary-state";
import { SummaryView } from "./SummaryView";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const TABS: { value: Period; label: string }[] = [
  { value: "daily", label: "Day" },
  { value: "weekly", label: "Week" },
  { value: "monthly", label: "Month" },
];

export function DashboardClient() {
  const [state, dispatch] = useReducer(summaryReducer, undefined, () => initialSummaryState("weekly"));
  const period = state.period;

  useEffect(() => {
    if (!shouldFetch(state, period)) return;
    let cancelled = false;
    dispatch({ type: "loading", period });
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const date = DateTime.now().toISODate()!;
    generateSummary({ period, date, zone }).then((res) => {
      if (cancelled) return;
      if (res.ok) dispatch({ type: "loaded", period, summary: res.summary });
      else dispatch({ type: "error", period, error: res.error, needsSignIn: Boolean(res.needsSignIn) });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const cell = state.byPeriod[period];

  return (
    <div className="space-y-6">
      <Tabs value={period} onValueChange={(v) => dispatch({ type: "select", period: v as Period })}>
        <TabsList>
          {TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {(!cell || cell.status === "loading") && (
        <Card><CardContent className="space-y-4 p-6">
          <Skeleton className="h-6 w-3/4" />
          <div className="grid grid-cols-2 gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
          <Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-2/3" />
        </CardContent></Card>
      )}

      {cell?.status === "error" && (
        <Alert variant="destructive">
          <AlertDescription className="space-y-3">
            <p>{cell.error}</p>
            {cell.needsSignIn && (
              <Button onClick={() => signIn("google", { redirectTo: "/dashboard" })}>Sign in with Google</Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {cell?.status === "loaded" && (cell.summary.empty
        ? <Card><CardContent className="p-6 text-muted-foreground">Nothing scheduled for this period.</CardContent></Card>
        : <Card><CardContent className="p-6"><SummaryView summary={cell.summary} /></CardContent></Card>)}
    </div>
  );
}
```

- [ ] **Step 3: Delete PeriodSelector**

```bash
git rm components/PeriodSelector.tsx
```

- [ ] **Step 4: Update the dashboard page (Header + restyle the gate)**

Rewrite `app/dashboard/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignInButton } from "@/components/SignInButton";
import { SignOutButton } from "@/components/SignOutButton";
import { Header } from "@/components/Header";
import { DashboardClient } from "@/components/DashboardClient";

export default async function Dashboard() {
  const session = await auth();
  if (!session) redirect("/");

  if (session.calendarGranted === false) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
        <h1 className="text-2xl font-medium">Calendar access needed</h1>
        <p className="text-muted-foreground">This app needs read access to your Google Calendar to summarize it. Please sign in again and allow the calendar permission.</p>
        <SignInButton label="Sign in and allow access" />
        <SignOutButton />
      </main>
    );
  }

  return (
    <>
      <Header user={{ name: session.user?.name, email: session.user?.email, image: session.user?.image }} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-medium">Your calendar</h1>
        <DashboardClient />
      </main>
    </>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`, `npx vitest run` (all green — logic unchanged), `npx next build`. Then `npm run dev`, open `/dashboard`: confirm the skeleton shows immediately, the summary fills in, switching Day/Week/Month fetches once per period and is instant on return, and an error (e.g. quota) renders in an Alert. Check light and dark.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): auto-summary dashboard with tabs, skeleton, and cached periods"
```

---

## Task 6: Assistant — restyle only

**Files:** Rewrite `components/ChatClient.tsx`, `components/ConfirmWriteCard.tsx`; Modify `app/assistant/page.tsx`.

**Interfaces:**
- Consumes: `@/components/ui/{card,input,button,scroll-area,alert}`, `Header`, and the UNCHANGED `sendChatMessage`/`confirmWrite`/`declineWrite` from `@/lib/chat-actions`, `PendingWrite` type, `ModelMessage` from `ai`.
- **Behavior must not change** — same calls, same history handling, same confirm/decline flow. Only markup/styling changes.

- [ ] **Step 1: Rewrite ConfirmWriteCard**

Rewrite `components/ConfirmWriteCard.tsx` (props unchanged: `pending`, `busy`, `onConfirm`, `onCancel`):

```tsx
import type { PendingWrite } from "@/lib/chat/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ConfirmWriteCard({ pending, busy, onConfirm, onCancel }: {
  pending: PendingWrite; busy: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Card className="border-primary/40">
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-medium">{pending.summary}</p>
        <div className="flex gap-2">
          <Button size="sm" onClick={onConfirm} disabled={busy}>Confirm</Button>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

Match the actual current prop names in `components/ConfirmWriteCard.tsx` before rewriting — if the current props differ from `{ pending, busy, onConfirm, onCancel }`, keep whatever `ChatClient` passes and restyle around it.

- [ ] **Step 2: Rewrite ChatClient (restyle, same logic)**

Rewrite `components/ChatClient.tsx`, preserving the exact state and calls from the current file (zone, `messages` state, `sendChatMessage`/`confirmWrite`/`declineWrite`, `apply`, `send`, `onConfirm`, `onCancel`, `bubblesFrom`). Only the returned JSX changes:

```tsx
"use client";
import { useState } from "react";
import type { ModelMessage } from "ai";
import type { PendingWrite } from "@/lib/chat/types";
import { sendChatMessage, confirmWrite, declineWrite, type ChatResult } from "@/lib/chat-actions";
import { ConfirmWriteCard } from "./ConfirmWriteCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";

interface Bubble { role: "user" | "assistant"; text: string }

function textOf(content: ModelMessage["content"]): string {
  if (typeof content === "string") return content;
  return content.map((p) => ("text" in p && typeof (p as { text?: unknown }).text === "string" ? (p as { text: string }).text : "")).join("").trim();
}
function bubblesFrom(messages: ModelMessage[]): Bubble[] {
  const out: Bubble[] = [];
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const text = textOf(m.content);
    if (text) out.push({ role: m.role, text });
  }
  return out;
}

export function ChatClient() {
  const zone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const [messages, setMessages] = useState<ModelMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<PendingWrite | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function apply(res: ChatResult) {
    if (!res.ok) { setError(res.error); return; }
    setError(null); setMessages(res.messages); setPending(res.pending ?? null);
  }
  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next: ModelMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next); setInput(""); setBusy(true);
    apply(await sendChatMessage(next, zone)); setBusy(false);
  }
  async function onConfirm() {
    if (!pending) return; setBusy(true);
    const res = await confirmWrite(messages, pending, zone);
    setPending(null); setBusy(false);
    if (!res.ok) { setError(res.error); return; } setError(null); setMessages(res.messages);
  }
  async function onCancel() {
    if (!pending) return; setBusy(true);
    const res = await declineWrite(messages, pending, zone);
    setPending(null); setBusy(false);
    if (!res.ok) { setError(res.error); return; } setError(null); setMessages(res.messages);
  }

  const bubbles = bubblesFrom(messages);
  return (
    <div className="flex flex-col gap-4">
      <ScrollArea className="h-[60vh] rounded-xl border p-4">
        {bubbles.length === 0 && !busy && (
          <p className="py-16 text-center text-sm text-muted-foreground">Ask about your schedule — e.g. "what's on today?" or "add lunch with Sam Thursday at 1pm".</p>
        )}
        <div className="space-y-3">
          {bubbles.map((b, i) => (
            <div key={i} className={cn("flex", b.role === "user" ? "justify-end" : "justify-start")}>
              <span className={cn("inline-block max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm",
                b.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                {b.text}
              </span>
            </div>
          ))}
          {pending && <ConfirmWriteCard pending={pending} busy={busy} onConfirm={onConfirm} onCancel={onCancel} />}
          {busy && !pending && <p className="text-sm text-muted-foreground">Thinking…</p>}
        </div>
      </ScrollArea>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} disabled={busy || !!pending}
          placeholder="Message the assistant…" />
        <Button type="submit" size="icon" disabled={busy || !!pending || !input.trim()} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </form>
      {pending && <p className="text-xs text-muted-foreground">Confirm or cancel the pending action to continue.</p>}
    </div>
  );
}
```

Before committing, diff this against the current `ChatClient.tsx` to confirm the logic (state, the three server-action calls, `bubblesFrom`) is byte-for-byte the same — only JSX/styling changed.

- [ ] **Step 3: Update the assistant page (Header + gate restyle)**

Rewrite `app/assistant/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignInButton } from "@/components/SignInButton";
import { SignOutButton } from "@/components/SignOutButton";
import { Header } from "@/components/Header";
import { ChatClient } from "@/components/ChatClient";

export default async function AssistantPage() {
  const session = await auth();
  if (!session) redirect("/");
  if (session.calendarGranted === false) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
        <h1 className="text-2xl font-medium">Calendar access needed</h1>
        <p className="text-muted-foreground">The assistant needs read and write access to your Google Calendar. Please sign in again and allow it.</p>
        <SignInButton label="Sign in and allow access" />
        <SignOutButton />
      </main>
    );
  }
  return (
    <>
      <Header user={{ name: session.user?.name, email: session.user?.email, image: session.user?.image }} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-medium">Assistant</h1>
        <ChatClient />
      </main>
    </>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`, `npx vitest run` (green), `npx next build`. Then `npm run dev`, open `/assistant`: empty state, send a message (Thinking… → reply), trigger a write and confirm the card shows a violet Confirm + ghost Cancel and the flow still works. Check light and dark.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): redesign assistant chat UI (restyle only)"
```

---

## Task 7: Final verification & polish

**Files:** none required; fix anything the gate surfaces.

- [ ] **Step 1: Full gate**

Run from `web/`:

```bash
npx tsc --noEmit
npx vitest run
npx next build
```

All must pass. Confirm no `console.error`/stray debug remains: `git grep -n "console.log" components app || echo clean`.

- [ ] **Step 2: Visual pass (both themes)**

`npm run dev`, and in light AND dark verify: landing (hero + cards), dashboard (skeleton → summary, tabs cache, error Alert, empty state), assistant (empty, thinking, reply, confirm card), the Header (nav active states, theme toggle flips, avatar menu → sign out), and the calendar-access gate screens. No layout breaks at phone width (375px).

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(web): redesign polish and verification"
```

(If nothing needed fixing, skip this commit.)

---

## Self-Review

**Spec coverage:**
- Design system + violet theme + dark mode (next-themes, system default) → Task 1. ✓
- App shell (Header, nav, theme toggle, avatar/sign-out) → Task 2, wired in Tasks 5–6. ✓
- Landing redesign (hero + 3 feature cards) → Task 3. ✓
- Auto-summary on load + per-period cache + skeleton/error/empty states → Task 4 (logic, tested) + Task 5 (UI). ✓
- Dashboard tabs (Day/Week/Month), metric tiles, SummaryView restyle → Task 5. ✓
- Assistant restyle with no behavior change → Task 6. ✓
- shadcn component list (button, card, input, tabs, dropdown-menu, avatar, badge, skeleton, alert, scroll-area, separator) → Task 1 Step 2. ✓
- Logic untouched / existing tests green → asserted in every task's verify + Tasks 5–6 run `vitest`. ✓
- Gate (tsc/vitest/build) + light/dark visual pass → Task 7. ✓
- calendarGranted gate restyled → Tasks 5 and 6. ✓

**Placeholder scan:** No TBD/TODO. Setup steps (shadcn CLI) have an explicit manual fallback with a docs link, not a vague placeholder. The one deliberately-flagged spot — matching `ConfirmWriteCard`'s current prop names before rewriting — is a concrete guard, not a placeholder.

**Type consistency:** `Cell`/`SummaryState`/`SummaryAction`/`summaryReducer`/`shouldFetch`/`initialSummaryState` (Task 4 Produces) are used exactly by that shape in Task 5's `DashboardClient`. `Header({ user })` prop shape (Task 2) matches the calls in Tasks 5 and 6. `generateSummary` and `Summary` field names (`overview`, `keyEvents`, `timeBreakdown`, `highlights`, `empty`) match the engine types. `ChatResult`/`PendingWrite` usage in Task 6 matches the unchanged `chat-actions`. Consistent.

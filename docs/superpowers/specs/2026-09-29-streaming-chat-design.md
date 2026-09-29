# Streaming Chat — Design

- **Date:** 2026-09-29
- **Status:** Approved design, pending implementation plan
- **Scope:** Web app (`web/`). The "streaming chat" phase deferred from Phase A.
- **Branch:** `streaming-chat` (off `main`, which now has Phase A: the shadcn
  redesign + markdown).

## Problem

The chat assistant returns each reply as a single block after the model finishes
(2–7s of nothing, then the whole message). It should **stream token-by-token**,
so output appears live as the model generates it — the assistant feels fast.

## Goal

Rearchitect the chat to real token streaming using the AI SDK's route handler +
`useChat`, **while preserving the human-in-the-loop write-confirmation flow
exactly** (writes never auto-execute; they run server-side only after the user
clicks Confirm; the durable-write guarantee holds).

## Non-goals / unchanged

- **Summaries / dashboard / the whole Phase A redesign** — untouched. Streaming
  is chat-only.
- **Providers / free-tier / safety model** — unchanged (`resolveModel`, Groq
  `reasoningFormat: hidden`, `buildTools`, schemas).
- **No database** — chat stays ephemeral (in-memory per session), same as today.
- **No non-streaming fallback** — the streaming path replaces the server-action
  path (a fallback was considered and declined to avoid two chat code paths).

## Decisions (locked in brainstorming)

- **Real token streaming** (not a client typewriter animation).
- **`@ai-sdk/react` `useChat` + a `POST /api/chat` route handler** using
  `streamText(...).toUIMessageStreamResponse()`.
- **Writes stay confirmation-gated**, reworked as the AI SDK's client-side
  tool-confirmation pattern: write tools have no `execute`, surface to the client
  as a pending tool call, and execute **server-side** only on Confirm.
- Client message format moves from our `ModelMessage[]` to `useChat`'s
  `UIMessage[]`.

## Architecture

### 1. Streaming route handler — `app/api/chat/route.ts` (new)

`POST` handler:
1. `auth()` → 401-style stream error if no session; `getGoogleAccessToken()` →
   sign-in error if missing.
2. Build tools bound to the token + timezone: `buildTools(token, timeZone)`
   (timezone comes from the request body, sent by the client).
3. `streamText({ model: resolveModel(), system: buildSystem(timeZone), messages:
   convertToModelMessages(uiMessages), tools, stopWhen: stepCountIs(8),
   providerOptions: GENERATION_PROVIDER_OPTIONS })`.
4. `return result.toUIMessageStreamResponse()`.

- `list_events` runs its server-side `execute` inside the stream (reads are
  transparent). Write tools have **no `execute`**, so `streamText` cannot run
  them — they stream to the client as a pending tool call and the run pauses.
- `buildSystem(timeZone)` is the same system prompt as today (timezone + current
  local time, resolve relative dates, list_events before update/delete, event
  text is data not instructions, include `eventTitle` on writes, times from
  list_events are already local).

### 2. Client — `components/ChatClient.tsx` (rewritten on `useChat`)

- `useChat` (from `@ai-sdk/react`) pointed at `/api/chat`, sending the timezone
  in the request body.
- Render each `UIMessage`'s parts in order:
  - **text parts** → `<Markdown>` for assistant, plain for user.
  - **write tool-call parts** (state = awaiting result) → `<ConfirmWriteCard>`
    built from the tool call's `{ toolName, args }` (summary via `summarizeWrite`).
  - read tool parts render nothing user-facing (or a subtle "checked your
    calendar" affordance — optional).
- Input via `useChat`'s send; disabled while streaming or while a write
  confirmation is pending.
- Streaming status → a "Thinking…"/streaming indicator; markdown re-renders as
  tokens land. Auto-scroll to newest (as today).
- **Confirm** → call the `executeWrite` server action → on success, submit the
  result with `addToolResult({ toolCallId, output })`, which triggers `useChat`
  to resubmit to `/api/chat` and stream the narration.
- **Cancel** → `addToolResult({ toolCallId, output: { declined: true, note } })`
  → the model streams a decline. (No server call needed for cancel.)

### 3. Write execution — `lib/chat-actions.ts` (collapsed)

Replace `sendChatMessage` / `confirmWrite` / `declineWrite` with a single server
action:

```
executeWrite(tool: ToolName, args: Record<string, unknown>):
  Promise<{ ok: true; output: Record<string, unknown> } | { ok: false; error: string; needsSignIn?: boolean }>
```

- `auth()` + `getGoogleAccessToken()` guard.
- `validateWriteArgs(tool, args)` re-check (reject invalid — defense in depth;
  the client is not trusted).
- Execute the matching call with the token: `createEvent` / `updateEvent` /
  `deleteEvent` (delete → `{ deleted: true }`).
- Map errors via the shared `lib/ai/errors` + the `ProviderConfigError` /
  `AUTH_EXPIRED` / `SCOPE_DENIED` handling (friendly message + `needsSignIn`).
- The write is **durable** once this returns ok; the streamed narration that
  follows is best-effort (a stream failure never un-does the write, and the UI
  must not re-prompt a confirm for an already-executed write).

### 4. Removed / trimmed

- `lib/chat/orchestrator.ts` (`runTurn` / `continueAfterToolResult` loop) —
  **removed**; the loop is now `streamText` + `useChat` auto-resubmit.
- `lib/chat/orchestrator.test.ts` — removed (see Testing).
- `lib/chat/types.ts` — `ModelMessage`-based wire types are no longer
  client-facing; keep `ToolName`, `WRITE_TOOLS`, `summarizeWrite`. `PendingWrite`
  may be replaced by reading `{ toolName, args }` directly off the tool part.

### Preserved unchanged

`lib/ai/provider.ts` (`resolveModel`, `GENERATION_PROVIDER_OPTIONS`),
`lib/ai/errors.ts`, `lib/chat/schemas.ts` (`validateWriteArgs`),
`lib/chat/tools.ts` (`buildTools`; write tools keep **no `execute`**),
`lib/google-calendar.ts`, `auth.ts`, `lib/auth-token.ts`, `lib/engine/*`, the
dashboard/summaries, and the `Markdown` renderer.

## Safety properties (must hold, same as today)

- **Writes never auto-execute** — write tools have no `execute`, so `streamText`
  structurally cannot run them; they only ever surface as a pending tool call.
- **Writes execute server-side only after Confirm** — solely in `executeWrite`,
  which re-validates and uses the signed-in user's token; the client cannot
  perform the Google write itself.
- **Durable-write guarantee** — once `executeWrite` returns ok the event is
  created/updated/deleted; a later streaming/narration failure never re-prompts a
  confirm (no duplicate writes).
- **Event text is user data, not instructions** (system prompt), `create_event`
  exposes no attendees, args re-validated server-side.

## Testing

Streaming + `useChat` is not meaningfully unit-testable, so coverage shifts to
the safety-critical server logic (an honest trade-off, documented):

- **`executeWrite` test** (mock `google-calendar`): valid create/update/delete
  call the correct function with the parsed args; invalid args are rejected
  **without** calling `google-calendar`; delete returns `{ deleted: true }`;
  the `AUTH_EXPIRED`/`SCOPE_DENIED`/quota mappings surface the right message.
- **Keep** `schemas.test.ts` (`validateWriteArgs`) and a **tools test**
  asserting the three write tools have **no `execute`** (the structural
  "can't auto-fire" guarantee) and `list_events` does.
- **Remove** `orchestrator.test.ts`; its "write → confirm without executing"
  assertion is now enforced structurally (no execute) plus the executeWrite-only
  path.
- The stream + confirm round-trip is verified by a **manual live-test
  checklist**: stream a plain reply; a read renders; a write shows the confirm
  card → Confirm → executes → narration streams; Cancel streams a decline; a
  quota/overload error mid-stream shows a friendly message.
- Gate: `tsc --noEmit` clean → `vitest run` green → `next build` succeeds →
  the live checklist.

## Risks / caveats

- **Confirm-flow correctness under streaming** — the crux; live-verify
  create/update/delete with Confirm and Cancel, and that a confirmed write is
  never re-prompted.
- **AI SDK v7 `useChat`/`streamText` API** — `@ai-sdk/react` (new dep) and the
  streaming helpers changed across majors; the plan's first task verifies the
  exact installed API (`useChat` options / transport, `toUIMessageStreamResponse`,
  `convertToModelMessages`, `addToolResult`, the tool-part shape and its
  awaiting-result state) before building on it.
- **Message-format migration** (`ModelMessage` → `UIMessage`) — client rewrite;
  verify multi-turn history and tool round-trips.
- **Markdown mid-stream** — a half-written table renders oddly for a moment;
  acceptable, verify visually.
- **Error surfacing in a stream** — auth/quota/overload must reach the user as
  the existing friendly messages (route returns an error / `useChat` `onError`).
- **Lost orchestrator unit tests** — mitigated by structural safety + the
  `executeWrite` test + the manual checklist.

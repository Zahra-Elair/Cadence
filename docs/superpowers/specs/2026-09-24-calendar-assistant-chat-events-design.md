# Calendar Summarizer — Phase 3: Conversational Event Assistant (Design Spec)

**Date:** 2026-09-24
**Status:** Approved for implementation planning
**Builds on:** Phase 2 web app —
`docs/superpowers/specs/2026-09-22-calendar-summarizer-web-phase2-design.md`

---

## 1. Goal

Add a **conversational chat assistant** to the web app that can read and modify
the user's Google Calendar through natural language: check the schedule, create,
update, and delete events. Powered by **Gemini function calling**. Every write is
gated behind an explicit user confirmation. Session-based, **no database** (same
as Phase 2).

Out of scope for this phase: recurring-event rules, multi-calendar selection
(primary only), streaming responses, persistent chat history, and email/scheduled
delivery.

---

## 2. Interaction model

A multi-turn chat: the user types natural language; the assistant replies, and may
call calendar tools. Read tools run automatically; write tools are proposed and
require confirmation. The assistant can ask clarifying questions ("which
Thursday?") and handle multi-step requests.

---

## 3. Architecture — human-in-the-loop function-calling

The core is a function-calling loop with writes gated on user confirmation:

```
User message
  → sendChatMessage(history, timeZone) [server action]
      → Gemini receives [system prompt + history + tool declarations]
      → Gemini returns one of:
          • text                         → returned to the UI as the assistant reply
          • a READ call (list_events)    → server executes immediately,
                                            appends the result, loops back to Gemini
          • a WRITE call (create/update/delete_event)
                                         → server STOPS, returns a "pending action"
                                            (validated args) to the UI. Nothing written.
  → UI shows a confirmation card for the pending write. On:
      • Confirm → executeConfirmedWrite(history, action) [server action]
                  performs the Google Calendar write, appends the tool result,
                  loops back to Gemini for a follow-up ("Done ✅")
      • Cancel  → declineWrite(history, action) appends a "user declined" tool
                  result; Gemini acknowledges
```

**Key invariant:** the model may *propose* a write, but only the user's Confirm
click executes it. Reads run freely; anything that changes the calendar is gated.

**Multiple writes in one turn:** if the model proposes more than one write at once,
they are surfaced and confirmed **one at a time** — the loop pauses on the first
write, and resumes for the next only after it is confirmed or declined.

**State (no DB):** the browser holds the full conversation history — including the
structured function calls and their results — and sends it to the server on each
turn. The pending write lives in client state between "proposed" and "confirmed."

**Chosen approach:** Gemini native function calling (rejected: a single structured
"intent" per turn — weaker at multi-step/clarifying; an agent framework — overkill
for four tools).

---

## 4. Tools

Function declarations passed to Gemini:

| Tool | Type | Parameters |
|------|------|-----------|
| `list_events` | read | `timeMin` (ISO), `timeMax` (ISO) |
| `create_event` | write | `title`, `start` (ISO), `end` (ISO), `location?`, `description?`, `attendees?` (emails) |
| `update_event` | write | `eventId`, plus any of `title`/`start`/`end`/`location`/`description` |
| `delete_event` | write | `eventId` |

`list_events` returns events **including their Google event IDs**, so
`update_event`/`delete_event` can reference them. The model resolves natural
language to concrete ISO datetimes using the current date + user timezone provided
in the system prompt; the confirmation card displays the resolved values.

---

## 5. Calendar module (writes)

Extend `web/lib/google-calendar.ts` with functions mirroring the existing read
(same `Bearer` auth, same 401→`AUTH_EXPIRED` / 403→`SCOPE_DENIED` error mapping):

- `listEventsInRange(token, timeMin, timeMax)` → events **with `id`**
- `createEvent(token, input)` → `POST events.insert`
- `updateEvent(token, eventId, patch)` → `PATCH events.patch`
- `deleteEvent(token, eventId)` → `DELETE events.delete`

The `CalEvent` type (or a chat-specific event shape) gains an optional `id` so
existing-event references survive the round trip.

---

## 6. Orchestration module

New `web/lib/chat/`:
- Tool declarations (JSON schema per tool).
- `web/lib/chat-actions.ts` (`"use server"`):
  - `sendChatMessage(history, timeZone)` → `{ history, pendingWrite? , reply }`
  - `executeConfirmedWrite(history, pendingWrite)` → `{ history, reply }`
  - `declineWrite(history, pendingWrite)` → `{ history, reply }`
- The access token is read server-side via the existing `getToken()` +
  refresh-on-read path (never exposed to the browser).
- **Argument validation** before proposing any write: required fields present,
  `start`/`end` are valid ISO and `end > start`; invalid args are not proposed —
  the model is told to correct itself, or a clear error is surfaced.
- **Manual function calling** — the loop drives tool calls itself and does **not**
  use the SDK's automatic function calling (AFC). AFC would execute tool calls
  immediately inside `generateContent`, which would bypass the write-confirmation
  gate. We read `functionCall` parts from the response and decide per-tool whether
  to execute (reads) or pause for confirmation (writes).

---

## 7. Auth / scope change

In `web/auth.ts`, change the sign-in scope from
`https://www.googleapis.com/auth/calendar.readonly` to
**`https://www.googleapis.com/auth/calendar.events`** (Google's read+write events
scope — it also covers the Phase-2 summary reads, so both are not needed). The
`calendarGranted` check updates to look for `calendar.events`. Existing users
re-consent once to grant the broader permission. The unverified-app / test-user
gate is unchanged (a write scope is still "sensitive").

---

## 8. UI

A dedicated **`/assistant`** page, linked from the dashboard header (the summary
dashboard stays separate and focused):
- Message list (user + assistant bubbles), input box, send button.
- Loading indicator while the assistant thinks or runs a read tool.
- **Confirmation card** rendered inline when a write is pending — shows the action
  and the resolved details, e.g. *"🗓️ Create **Lunch with Sam** · Thu Sep 25,
  1:00–2:00 pm"*, with **[Confirm] [Cancel]**. Update/delete cards state exactly
  which event and what changes.
- A client component holds conversation history + pending-write state.
- **v1 is non-streaming** (send → wait → render); streaming is a later polish.
- Auth-gated like the dashboard; redirects to sign-in when unauthenticated, and
  shows the "calendar access needed" state if the write scope was not granted.

---

## 9. Safety & error handling

- **Write-confirmation gate** (§3) — no calendar change without a user click.
- **Argument validation** (§6) before a write is proposed.
- **Prompt-injection awareness:** event titles/descriptions read from the calendar
  are untrusted text; a malicious event could attempt to hijack the assistant. The
  confirmation gate is the primary defense (the assistant cannot act without the
  user), and the system prompt treats calendar content as data, not instructions.
- **Errors** reuse existing patterns: refresh-on-read for expiry, re-sign-in on
  `AUTH_EXPIRED`/`SCOPE_DENIED`, friendly messages on Google API errors, and the
  Gemini overload one-retry + "busy" message.
- **Deletes/updates** show the full human-readable target in the confirmation card
  so the user always sees exactly what will change before it happens.

---

## 10. Testing

- **Calendar write functions** — unit-tested with mocked `fetch`:
  `createEvent`/`updateEvent`/`deleteEvent`/`listEventsInRange`, including error
  mapping (401/403/other).
- **Orchestration** — unit-tested with a mocked Gemini client + mocked calendar
  functions:
  - a read call → executed, result appended, loops;
  - a write call → returns a **pending action without executing**;
  - confirm → executes the write;
  - decline → does not execute;
  - argument validation rejects bad dates / missing fields.
- All offline (Vitest, mocked). The real chat→create/update/delete flow is
  verified live by the user against their calendar.

---

## 11. Tech stack additions

- Gemini function calling via `@google/genai` (model `gemini-3.6-flash`),
  server-side.
- No new runtime dependencies expected beyond what Phase 2 already has.

---

## 12. Out of scope for Phase 3 (YAGNI)

Recurring-event rules, multi-calendar selection, streaming, persistent/stored chat
history, undo of a confirmed write (rely on Google Calendar's own trash),
incremental scope consent, and public Google app verification.

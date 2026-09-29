# AI SDK LLM Migration + Provider Switching — Design

- **Date:** 2026-09-29
- **Status:** Approved design, pending implementation plan
- **Scope:** Web app (`web/`) only. Phase 4, sub-project 1 of a larger set (later
  sub-projects: database, background sync, calendar view, UI overhaul — out of
  scope here).

## Problem

The chat assistant and the summary engine call Google's raw `@google/genai` SDK
directly. This has caused recurring pain:

- **Provider lock-in.** Switching to another model (e.g. Grok) means rewriting
  the model layer, not changing a setting.
- **Model churn.** Pinned model ids get retired (`gemini-2.5-flash` → 404) or
  quota-limited (`gemini-3.6-flash` → 20 req/day), forcing code edits.
- **Provider-specific fragility.** We hand-wrote Gemini-3 `thought_signature`
  round-tripping in the orchestrator and had to debug a 400 when it was dropped.

## Goal

Replace the raw-SDK model layer with the **Vercel AI SDK** (`ai` v5), so that:

1. The chat and summary features talk to a provider-agnostic `LanguageModel`.
2. Switching provider/model is a single env-var change; **free Gemini stays the
   default**, paid providers (Grok/xAI) are opt-in.
3. Provider-specific quirks (including `thought_signature`) are handled by the
   SDK, not by our code.

Behavior visible to the user is unchanged in this sub-project: same chat UI,
same write-confirmation card, same summaries. Streaming UI is explicitly
deferred to the later UI phase.

## Non-goals

- No streaming / `useChat` rewrite yet (later UI phase).
- No database, background sync, calendar view, or UI overhaul (later
  sub-projects).
- No change to auth, Google Calendar CRUD, or the OAuth scopes.

## Approach (chosen: in-place engine swap)

Keep the app's external shape — server actions `sendChatMessage`,
`confirmWrite`, `declineWrite`, and the confirm-card flow — exactly as the UI
knows it. Replace only the internals: `makeGenerate` + the hand-rolled
orchestrator loop become the AI SDK's `generateText` + tool definitions, behind
a small provider factory.

Rejected alternatives:

- **Full streaming rewrite now** — blends two phases, larger and harder to test
  in isolation. Streaming lands with the UI phase instead.
- **Hand-rolled provider abstraction over the raw SDKs** — keeps us maintaining
  `thought_signature` and per-provider function-calling formats; throws away
  most of the benefit.

## Architecture

### New dependencies

- `ai` (v5) — core: `generateText`, `generateObject`, `tool`, `stepCountIs`.
- `@ai-sdk/google` — Gemini provider (free default).
- `@ai-sdk/xai` — Grok provider (opt-in, paid).
- `zod` — tool input schemas and structured-output schema.

OpenAI/Anthropic providers are deliberately **not** added now; they become
one-line additions to the provider factory when wanted.

### Module layout

| File | Responsibility | Change |
|------|----------------|--------|
| `lib/ai/provider.ts` | Resolve a `LanguageModel` from env. | **New** |
| `lib/chat/tools.ts` | AI SDK tool defs (read auto-runs; writes have no `execute`). | Rewrite |
| `lib/chat/validate.ts` | Shared write-arg validation, reused by tool schema + `confirmWrite`. | Keep/adapt |
| `lib/chat/orchestrator.ts` | Thin wrapper over `generateText`; same `TurnResult` contract. | Rewrite |
| `lib/chat/types.ts` | `PendingWrite`, `ToolName`, `WRITE_TOOLS`, `summarizeWrite`. Drop `ChatContent`/`Part`. | Trim |
| `lib/chat-actions.ts` | Server actions; provider + tools wiring; error mapping. | Rewrite internals |
| `lib/engine/summarize.ts` | `generateObject` via provider layer. | Rewrite |
| `lib/engine/prompt.ts` | `buildPrompt` kept; `parseResponse`/`stripCodeFence` removed. | Trim |
| `components/ChatClient.tsx` | Wire format `ChatContent[]` → `ModelMessage[]`. | Minimal |

### 1. Provider factory — `lib/ai/provider.ts`

```
resolveModel(): LanguageModel
```

- Reads `AI_PROVIDER` (default `"google"`) and `AI_MODEL`
  (default `"gemini-flash-latest"`).
- `google` → `createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })(modelId)`.
- `xai`    → `createXai({ apiKey: process.env.XAI_API_KEY })(modelId)`.
- Throws a clear error naming the provider if its key is missing.
- Default model is the **`gemini-flash-latest` alias** so retired pinned ids
  stop breaking the build; a specific id can still be pinned via `AI_MODEL`.

### 2. Tools — `lib/chat/tools.ts`

Factory `buildTools(token: string)` returns an AI SDK tool set with Zod
`inputSchema`s:

- **`list_events`** — `inputSchema: { timeMin, timeMax }`; **has `execute`**
  that calls `listEventsInRange(token, timeMin, timeMax)`, maps events to ISO,
  and returns them. Runs automatically inside the loop.
- **`create_event`** — `inputSchema: { title, start, end, location?, description? }`;
  **no `execute`**. No attendees param (safety).
- **`update_event`** — `inputSchema: { eventId, title?, start?, end?, location?, description? }`;
  **no `execute`**.
- **`delete_event`** — `inputSchema: { eventId }`; **no `execute`**.

Because the write tools have no `execute`, the model cannot cause a write during
generation — the SDK has nothing to invoke. Writes execute only in
`confirmWrite`, after explicit user approval.

Zod schemas encode the validation rules currently in `validate.ts` (non-empty
title/eventId, valid ISO datetimes, `end > start`) via `.refine()`. A shared
`validateWriteArgs` (keyed by tool name) remains for `confirmWrite`'s
server-side re-check.

### 3. Orchestrator — `lib/chat/orchestrator.ts`

Same public contract:

```
type TurnResult =
  | { kind: "reply";   messages: ModelMessage[]; reply: string }
  | { kind: "confirm"; messages: ModelMessage[]; pending: PendingWrite };

runTurn(messages, model, tools): Promise<TurnResult>
continueAfterToolResult(messages, toolCallId, toolName, result, model, tools): Promise<TurnResult>
```

- `runTurn` calls `generateText({ model, system, messages, tools, stopWhen: stepCountIs(8) })`.
  - The SDK auto-runs `list_events` across steps.
  - Terminates with **final text** → `{ kind: "reply", messages: [...messages, ...response.messages], reply: text }`.
  - Terminates with an **unexecuted write tool call** (`finishReason: "tool-calls"`,
    a `toolCall` for a write tool with no result) → re-validate its args →
    `{ kind: "confirm", messages, pending: { tool, args, toolCallId, summary: summarizeWrite(...) } }`.
    The `toolCallId` is carried on `PendingWrite` so `confirmWrite` can build a
    tool-result message that matches the original call.
- `continueAfterToolResult` appends a tool-result message for the confirmed
  write (matched by `toolCallId`), then `generateText` again for the narration →
  `{ kind: "reply" }`.
- System instruction is unchanged in intent: timezone + current time, resolve
  relative dates to ISO-with-offset, use `list_events` before update/delete,
  event text is user data not instructions.
- All `thought_signature` / raw-content handling is deleted.

### 4. Server actions — `lib/chat-actions.ts`

- `ChatResult` union unchanged except history type becomes `ModelMessage[]`.
- `withContext` still: `auth()` → `getGoogleAccessToken()` → run fn → map errors.
  **The TEMP `console.error("[chat] action failed:", err)` is removed.**
- `sendChatMessage(messages, timeZone)` → `runTurn`.
- `confirmWrite(messages, pending, timeZone)`:
  1. `validateWriteArgs(pending.tool, pending.args)`; bail with a friendly error
     if invalid.
  2. Execute `createEvent` / `updateEvent` / `deleteEvent` via `google-calendar`
     using the signed-in user's token.
  3. Best-effort narration via `continueAfterToolResult`; on failure, return
     `ok: true` with `"Done."` (durable-write guarantee — never prompt a
     re-confirm that would duplicate the write).
- `declineWrite(...)` feeds a declined tool result back for the follow-up.
- **Error mapping** reads `APICallError.statusCode` / `.responseBody` /
  `.isRetryable`:
  - `AUTH_EXPIRED` / `SCOPE_DENIED` (from `google-calendar`) → `needsSignIn`.
  - quota (429 / resource_exhausted / rate limit) → "free-tier limit reached,
    resets daily; or switch `AI_MODEL`/`AI_PROVIDER`".
  - overload (503 / unavailable) → "busy, try again in a moment".
  - else → generic.
- The SDK's built-in retry (exponential backoff) replaces the manual 800ms
  retry loop.

### 5. Summaries — `lib/engine/summarize.ts`

- Use `generateObject({ model: resolveModel(), schema, prompt })` with a Zod
  schema `{ overview, keyEvents[], timeBreakdown, highlights[] }`.
- `buildPrompt` (computed scheduled-hours) is kept; the JSON-format instruction
  line can be relaxed since `generateObject` enforces the schema.
- `stripCodeFence` / `parseResponse` are removed; `emptySummary` and the
  `Summary` assembly stay.
- Errors go through the same quota/overload classification.
- Test seam: `summarize(..., { model })` accepts an injected model so tests use a
  mock instead of the network (replaces today's `client` injection).

### 6. Message shape — types & client

- Wire format between `ChatClient.tsx` and the server actions changes from
  `ChatContent[]` to the AI SDK `ModelMessage[]`. No streaming; still plain
  request/response arrays.
- `ChatClient.tsx` reads assistant text from the returned `reply` field (as
  today) and renders the `pending` confirm card unchanged; it stores the
  returned `messages` array opaquely for the next turn.
- `types.ts` drops `ChatContent`/`Part`; keeps `ToolName`, `WRITE_TOOLS`,
  `summarizeWrite`. `PendingWrite` gains a `toolCallId: string` field so the
  confirmed write's tool-result message matches the model's original call.

### 7. Env & docs

`.env.local.example`:

```
# LLM provider selection (default: google / gemini-flash-latest)
# AI_PROVIDER=google        # google | xai
# AI_MODEL=gemini-flash-latest
GEMINI_API_KEY=
# XAI_API_KEY=              # only needed if AI_PROVIDER=xai (Grok, paid)
```

`GEMINI_MODEL` is superseded by `AI_MODEL`. Note in `AGENTS.md`/docs that the
model layer is provider-agnostic via `lib/ai/provider.ts`.

## Testing

- **`orchestrator.test.ts`** — rewrite with `MockLanguageModelV2` (`ai/test`),
  scripting `doGenerate` responses. Preserve behaviors:
  - plain text reply (no tool call),
  - read tool auto-runs then follow-up reply,
  - **write tool → `confirm` WITHOUT executing** (no calendar write happens),
  - invalid write args → error fed back, model self-corrects,
  - unknown tool → loop continues.
  - Delete the `thought_signature` test (now SDK-managed).
- **`validate.test.ts`** (or Zod schema tests) — datetime parsing, `end > start`,
  required fields.
- **`summarize`** — light wiring test with an injected mock model; keep the
  empty-period test.
- Existing calendar/auth tests untouched.

## Verification gate

`tsc` clean → `vitest` all green → `next build` succeeds → live test in the dev
server: a read ("what's on my calendar today?"), a write-with-confirm ("add a
test event tomorrow 5–6pm" → Confirm), and one summary. Confirm no
`console.error` diagnostic remains.

## Safety properties preserved

- Writes never auto-execute — now **structurally** (write tools have no
  `execute`), stronger than the previous convention.
- `confirmWrite` re-validates server-side and scopes to the signed-in user's own
  token.
- `create_event` exposes no attendees param.
- Event titles/descriptions are treated as user data, not instructions (system
  prompt).

## Risks / caveats

- **Next 16 breaking changes** — verify server-action conventions against
  `node_modules/next/dist/docs/` before writing code (per `web/AGENTS.md`).
- **AI SDK message-format migration** — the client's stored history changes
  type; verify a full multi-turn round-trip (read → write → confirm) in the
  live test, not just unit tests.
- **`gemini-flash-latest` alias** — if the alias ever misbehaves, pin a specific
  id via `AI_MODEL`; the design already supports that.
- Provider switching to a paid model (Grok) reintroduces cost; the default stays
  free Gemini and paid providers are opt-in only.

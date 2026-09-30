"use server";

import type { JSONValue, ModelMessage } from "ai";
import { auth } from "@/auth";
import { getGoogleAccessToken } from "./auth-token";
import { resolveModel, ProviderConfigError } from "./ai/provider";
import { isQuota, isOverload } from "./ai/errors";
import { buildTools } from "./chat/tools";
import { buildSystem } from "./chat/system";
import { validateWriteArgs } from "./chat/schemas";
import type { PendingWrite } from "./chat/types";
import {
  runTurn, continueAfterToolResult, type TurnDeps, type TurnResult,
} from "./chat/orchestrator";
import { createEvent, updateEvent, deleteEvent } from "./google-calendar";

export type ChatResult =
  | { ok: true; messages: ModelMessage[]; reply?: string; pending?: PendingWrite }
  | { ok: false; error: string; needsSignIn?: boolean };

function mapError(err: unknown): ChatResult {
  const code = (err as { code?: string })?.code;
  if (code === "AUTH_EXPIRED" || code === "SCOPE_DENIED") {
    return { ok: false, error: "Your Google session or calendar permission needs a refresh. Please sign in again.", needsSignIn: true };
  }
  if (err instanceof ProviderConfigError) {
    return { ok: false, error: "The assistant isn't configured on the server (missing or invalid AI provider settings)." };
  }
  if (isQuota(err)) {
    return { ok: false, error: "Free-tier limit reached (it resets daily). Try again later, or switch AI_PROVIDER/AI_MODEL to another free provider." };
  }
  if (isOverload(err)) {
    return { ok: false, error: "The assistant is busy right now — please try again in a moment." };
  }
  return { ok: false, error: "Something went wrong. Please try again." };
}

function toResult(turn: TurnResult): ChatResult {
  return turn.kind === "confirm"
    ? { ok: true, messages: turn.messages, pending: turn.pending }
    : { ok: true, messages: turn.messages, reply: turn.reply };
}

async function withContext(
  timeZone: string,
  fn: (deps: TurnDeps, token: string) => Promise<ChatResult>,
): Promise<ChatResult> {
  const session = await auth();
  if (!session) return { ok: false, error: "Please sign in.", needsSignIn: true };
  const token = await getGoogleAccessToken();
  if (!token) return { ok: false, error: "Your session expired. Please sign in again.", needsSignIn: true };
  try {
    const deps: TurnDeps = { model: resolveModel(), tools: buildTools(token, timeZone), system: buildSystem(timeZone) };
    return await fn(deps, token);
  } catch (err) {
    return mapError(err);
  }
}

export async function sendChatMessage(messages: ModelMessage[], timeZone: string): Promise<ChatResult> {
  return withContext(timeZone, async (deps) => toResult(await runTurn(messages, deps)));
}

export async function confirmWrite(messages: ModelMessage[], pending: PendingWrite, timeZone: string): Promise<ChatResult> {
  return withContext(timeZone, async (deps, token) => {
    const check = validateWriteArgs(pending.tool, pending.args);
    if (!check.ok) return { ok: false, error: `Couldn't apply that change: ${check.error}.` };

    const a = pending.args as Record<string, string>;
    let output: Record<string, unknown>;
    if (pending.tool === "create_event") {
      output = await createEvent(token, { title: a.title, start: a.start, end: a.end, location: a.location, description: a.description });
    } else if (pending.tool === "update_event") {
      output = await updateEvent(token, a.eventId, { title: a.title, start: a.start, end: a.end, location: a.location, description: a.description });
    } else if (pending.tool === "delete_event") {
      await deleteEvent(token, a.eventId);
      output = { deleted: true };
    } else {
      return { ok: false, error: "Unsupported action." };
    }

    // The write is durable now; the follow-up narration is best-effort. If the
    // model fails here, do NOT report the write as failed (that would tempt a
    // re-confirm and duplicate the event).
    try {
      return toResult(await continueAfterToolResult(messages, pending.toolCallId, pending.tool, output, deps));
    } catch {
      const doneMessages: ModelMessage[] = [
        ...messages,
        { role: "tool", content: [{ type: "tool-result", toolCallId: pending.toolCallId, toolName: pending.tool, output: { type: "json", value: output as JSONValue } }] },
        { role: "assistant", content: "Done." },
      ];
      return { ok: true, messages: doneMessages, reply: "Done." };
    }
  });
}

export async function declineWrite(messages: ModelMessage[], pending: PendingWrite, timeZone: string): Promise<ChatResult> {
  return withContext(timeZone, async (deps) =>
    toResult(await continueAfterToolResult(messages, pending.toolCallId, pending.tool, { declined: true, note: "The user declined this action." }, deps)),
  );
}

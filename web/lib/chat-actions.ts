"use server";

import { auth } from "@/auth";
import { getGoogleAccessToken } from "./auth-token";
import { isQuota, isOverload } from "./ai/errors";
import { validateWriteArgs } from "./chat/schemas";
import type { ToolName } from "./chat/types";
import { buildRRule, type Recurrence } from "./chat/recurrence";
import { createEvent, updateEvent, deleteEvent } from "./google-calendar";

export async function executeWrite(
  tool: ToolName,
  args: Record<string, unknown>,
  timeZone: string = "UTC",
): Promise<{ ok: true; output: Record<string, unknown> } | { ok: false; error: string; needsSignIn?: boolean }> {
  const session = await auth();
  if (!session) return { ok: false, error: "Please sign in.", needsSignIn: true };
  const token = await getGoogleAccessToken();
  if (!token) return { ok: false, error: "Your session expired. Please sign in again.", needsSignIn: true };

  const check = validateWriteArgs(tool, args);
  if (!check.ok) return { ok: false, error: `Couldn't apply that change: ${check.error}.` };

  const a = args as Record<string, string>;
  try {
    if (tool === "create_event") {
      const rec = (args as { recurrence?: Recurrence }).recurrence;
      const recurrence = rec ? [buildRRule(rec, timeZone)] : undefined;
      const output = await createEvent(token, { title: a.title, start: a.start, end: a.end, location: a.location, description: a.description, recurrence });
      return { ok: true, output };
    }
    if (tool === "update_event") {
      const output = await updateEvent(token, a.eventId, { title: a.title, start: a.start, end: a.end, location: a.location, description: a.description });
      return { ok: true, output };
    }
    if (tool === "delete_event") {
      await deleteEvent(token, a.eventId);
      return { ok: true, output: { deleted: true } };
    }
    return { ok: false, error: "Unsupported action." };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "AUTH_EXPIRED" || code === "SCOPE_DENIED")
      return { ok: false, error: "Your Google session or calendar permission needs a refresh. Please sign in again.", needsSignIn: true };
    if (isQuota(err)) return { ok: false, error: "Free-tier limit reached (it resets daily). Try again later." };
    if (isOverload(err)) return { ok: false, error: "The assistant is busy right now — please try again in a moment." };
    return { ok: false, error: "Couldn't apply that change. Please try again." };
  }
}

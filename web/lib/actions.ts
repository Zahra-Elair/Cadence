"use server";

import { auth } from "@/auth";
import { getGoogleAccessToken } from "./auth-token";
import { fetchCalendarEvents } from "./google-calendar";
import { summarize, QuotaExceededError, MissingApiKeyError, SummarizerError } from "./engine/summarize";
import type { Period, Summary } from "./engine/types";

export type SummaryResult =
  | { ok: true; summary: Summary }
  | { ok: false; error: string; needsSignIn?: boolean };

export async function generateSummary(
  input: { period: Period; date: string; zone: string },
): Promise<SummaryResult> {
  const session = await auth();
  if (!session) {
    return { ok: false, error: "Your session expired. Please sign in again.", needsSignIn: true };
  }
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    return { ok: false, error: "Your session expired. Please sign in again.", needsSignIn: true };
  }
  try {
    const { events, startISO, endISO } = await fetchCalendarEvents(
      accessToken, input.period, input.date, input.zone,
    );
    const summary = await summarize(events, input.period, startISO, endISO, { zone: input.zone });
    return { ok: true, summary };
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "AUTH_EXPIRED") {
      return { ok: false, error: "Your Google session expired. Please sign in again.", needsSignIn: true };
    }
    if ((err as { code?: string })?.code === "SCOPE_DENIED") {
      return {
        ok: false,
        error:
          "Calendar access wasn't granted. Please sign in again and allow the calendar (read) permission.",
        needsSignIn: true,
      };
    }
    if (err instanceof QuotaExceededError) return { ok: false, error: "The AI provider's free-tier limit was reached. Try again shortly, or switch AI_PROVIDER / AI_MODEL." };
    if (err instanceof MissingApiKeyError) return { ok: false, error: "The AI provider isn't configured on the server (missing or invalid API key)." };
    if (err instanceof SummarizerError) return { ok: false, error: err.message };
    return { ok: false, error: "Something went wrong fetching your calendar. Please try again." };
  }
}

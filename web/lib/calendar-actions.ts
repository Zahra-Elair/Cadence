"use server";

import { DateTime } from "luxon";
import { auth } from "@/auth";
import { getGoogleAccessToken } from "./auth-token";
import { listEventsInRange } from "./google-calendar";
import type { CalendarEvent } from "./calendar/layout";

function toLocalISO(d: Date, timeZone: string): string {
  const dt = DateTime.fromJSDate(d).setZone(timeZone);
  return dt.isValid ? dt.toISO({ suppressMilliseconds: true })! : d.toISOString();
}

export async function fetchCalendarWeek(
  weekStartISO: string,
  timeZone: string,
): Promise<{ ok: true; events: CalendarEvent[] } | { ok: false; error: string; needsSignIn?: boolean }> {
  const session = await auth();
  if (!session) return { ok: false, error: "Please sign in.", needsSignIn: true };
  const token = await getGoogleAccessToken();
  if (!token) return { ok: false, error: "Your session expired. Please sign in again.", needsSignIn: true };

  const start = DateTime.fromISO(weekStartISO, { zone: timeZone });
  const timeMin = (start.isValid ? start : DateTime.now().setZone(timeZone).startOf("week")).toISO()!;
  const timeMax = DateTime.fromISO(timeMin).plus({ days: 7 }).toISO()!;

  try {
    const events = await listEventsInRange(token, timeMin, timeMax);
    return {
      ok: true,
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        start: toLocalISO(e.start, timeZone),
        end: toLocalISO(e.end, timeZone),
        allDay: e.allDay,
        location: e.location,
        description: e.description,
      })),
    };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "AUTH_EXPIRED" || code === "SCOPE_DENIED")
      return { ok: false, error: "Your Google session or calendar permission needs a refresh. Please sign in again.", needsSignIn: true };
    return { ok: false, error: "Couldn't load your calendar. Please try again." };
  }
}

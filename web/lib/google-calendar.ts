import { windowFor } from "./engine/windowing";
import type { CalEvent, Period } from "./engine/types";

export interface GoogleEvent {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email?: string; displayName?: string }[];
}

export function mapGoogleEvent(raw: GoogleEvent): CalEvent {
  const allDay = Boolean(raw.start?.date && !raw.start?.dateTime);
  const startStr = raw.start?.dateTime ?? raw.start?.date ?? "";
  const endStr = raw.end?.dateTime ?? raw.end?.date ?? startStr;
  return {
    id: raw.id,
    title: raw.summary?.trim() || "(no title)",
    start: new Date(startStr),
    end: new Date(endStr),
    allDay,
    location: raw.location,
    attendees: (raw.attendees ?? []).map((a) => a.email ?? a.displayName ?? "").filter(Boolean),
    description: raw.description,
  };
}

export async function fetchCalendarEvents(
  accessToken: string, period: Period, referenceISODate: string, zone: string,
): Promise<{ events: CalEvent[]; startISO: string; endISO: string }> {
  const { start, end } = windowFor(period, referenceISODate, zone);
  const params = new URLSearchParams({
    timeMin: start.toISO()!,
    timeMax: end.toISO()!,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );

  if (res.status === 401) {
    const e = new Error("Calendar authorization expired.");
    (e as { code?: string }).code = "AUTH_EXPIRED";
    throw e;
  }
  if (res.status === 403) {
    // The user signed in but did not grant the calendar.readonly scope.
    const e = new Error("Calendar access was not granted.");
    (e as { code?: string }).code = "SCOPE_DENIED";
    throw e;
  }
  if (!res.ok) throw new Error(`Calendar API error: ${res.status}`);
  const data = (await res.json()) as { items?: GoogleEvent[] };
  const events = (data.items ?? []).map(mapGoogleEvent);
  return { events, startISO: start.toISODate()!, endISO: end.toISODate()! };
}

const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export interface CreateEventInput {
  title: string;
  start: string; // ISO 8601 with offset
  end: string;
  location?: string;
  description?: string;
  attendees?: string[];
  recurrence?: string[]; // RFC-5545 RRULE lines, e.g. ["RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;COUNT=5"]
}
export interface UpdateEventPatch {
  title?: string;
  start?: string;
  end?: string;
  location?: string;
  description?: string;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function throwForStatus(status: number): never {
  if (status === 401) {
    const e = new Error("Calendar authorization expired.");
    (e as { code?: string }).code = "AUTH_EXPIRED";
    throw e;
  }
  if (status === 403) {
    const e = new Error("Calendar write access was not granted.");
    (e as { code?: string }).code = "SCOPE_DENIED";
    throw e;
  }
  throw new Error(`Calendar API error: ${status}`);
}

function toGoogleBody(input: CreateEventInput | UpdateEventPatch): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if ("title" in input && input.title !== undefined) body.summary = input.title;
  if (input.location !== undefined) body.location = input.location;
  if (input.description !== undefined) body.description = input.description;
  if (input.start !== undefined) body.start = { dateTime: input.start };
  if (input.end !== undefined) body.end = { dateTime: input.end };
  if ("attendees" in input && input.attendees?.length) {
    body.attendees = input.attendees.map((email) => ({ email }));
  }
  if ("recurrence" in input && input.recurrence?.length) {
    body.recurrence = input.recurrence;
  }
  return body;
}

export async function listEventsInRange(
  token: string, timeMin: string, timeMax: string,
): Promise<CalEvent[]> {
  const params = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "250" });
  const res = await fetch(`${EVENTS_URL}?${params}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) throwForStatus(res.status);
  const data = (await res.json()) as { items?: GoogleEvent[] };
  return (data.items ?? []).map(mapGoogleEvent);
}

export async function createEvent(token: string, input: CreateEventInput): Promise<{ id: string; htmlLink?: string }> {
  const res = await fetch(EVENTS_URL, { method: "POST", headers: authHeaders(token), body: JSON.stringify(toGoogleBody(input)), cache: "no-store" });
  if (!res.ok) throwForStatus(res.status);
  const data = (await res.json()) as { id: string; htmlLink?: string };
  return { id: data.id, htmlLink: data.htmlLink };
}

export async function updateEvent(token: string, eventId: string, patch: UpdateEventPatch): Promise<{ id: string }> {
  const res = await fetch(`${EVENTS_URL}/${encodeURIComponent(eventId)}`, { method: "PATCH", headers: authHeaders(token), body: JSON.stringify(toGoogleBody(patch)), cache: "no-store" });
  if (!res.ok) throwForStatus(res.status);
  const data = (await res.json()) as { id: string };
  return { id: data.id };
}

export async function deleteEvent(token: string, eventId: string): Promise<void> {
  const res = await fetch(`${EVENTS_URL}/${encodeURIComponent(eventId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  // 204 No Content on success; 410 Gone counts as already-deleted.
  if (!res.ok && res.status !== 410) throwForStatus(res.status);
}

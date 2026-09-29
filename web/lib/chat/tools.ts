import { tool, type ToolSet } from "ai";
import { DateTime } from "luxon";
import { listEventsSchema, createEventSchema, updateEventSchema, deleteEventSchema } from "./schemas";
import { listEventsInRange } from "../google-calendar";

/** Format an absolute instant as an ISO string in the user's timezone, so the
 *  model reads local wall-clock times and never has to convert UTC itself. */
function toLocalISO(d: Date, timeZone: string): string {
  const dt = DateTime.fromJSDate(d).setZone(timeZone);
  return dt.isValid ? dt.toISO({ suppressMilliseconds: true })! : d.toISOString();
}

/**
 * Tools bound to the signed-in user's access token.
 * Reads (`list_events`) run automatically. Writes have NO `execute`, so the
 * model cannot perform them during generation — they surface as pending tool
 * calls the orchestrator turns into a confirmation.
 */
export function buildTools(token: string, timeZone: string): ToolSet {
  return {
    list_events: tool({
      description:
        "List the user's calendar events between two ISO 8601 datetimes. Use this to check the schedule or find an event's id before updating or deleting it.",
      inputSchema: listEventsSchema,
      execute: async ({ timeMin, timeMax }) => {
        const events = await listEventsInRange(token, timeMin, timeMax);
        return {
          events: events.map((e) => ({
            id: e.id,
            title: e.title,
            start: toLocalISO(e.start, timeZone),
            end: toLocalISO(e.end, timeZone),
            allDay: e.allDay,
            location: e.location,
            attendees: e.attendees,
          })),
        };
      },
    }),
    create_event: tool({
      description:
        "Create a new calendar event. Resolve relative dates to concrete ISO 8601 datetimes with the user's timezone offset.",
      inputSchema: createEventSchema,
      // No execute: human-in-the-loop confirmation required.
    }),
    update_event: tool({
      description:
        "Update fields of an existing event. Get the eventId from list_events first, and pass the event's current title as eventTitle so the confirmation prompt reads naturally.",
      inputSchema: updateEventSchema,
      // No execute.
    }),
    delete_event: tool({
      description:
        "Delete an event. Get the eventId from list_events first, and pass the event's current title as eventTitle so the confirmation prompt reads naturally.",
      inputSchema: deleteEventSchema,
      // No execute.
    }),
  };
}

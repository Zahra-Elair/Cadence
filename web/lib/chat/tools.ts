import { Type, type FunctionDeclaration } from "@google/genai";

export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: "list_events",
    description: "List the user's calendar events between two ISO 8601 datetimes. Use this to check the schedule or find an event's id before updating or deleting it.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        timeMin: { type: Type.STRING, description: "Start of the range, ISO 8601 with timezone offset." },
        timeMax: { type: Type.STRING, description: "End of the range, ISO 8601 with timezone offset." },
      },
      required: ["timeMin", "timeMax"],
    },
  },
  {
    name: "create_event",
    description: "Create a new calendar event. Resolve relative dates to concrete ISO 8601 datetimes with the user's timezone offset.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        start: { type: Type.STRING, description: "ISO 8601 with offset." },
        end: { type: Type.STRING, description: "ISO 8601 with offset." },
        location: { type: Type.STRING },
        description: { type: Type.STRING },
      },
      required: ["title", "start", "end"],
    },
  },
  {
    name: "update_event",
    description: "Update fields of an existing event. Get the eventId from list_events first.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        eventId: { type: Type.STRING },
        title: { type: Type.STRING },
        start: { type: Type.STRING, description: "ISO 8601 with offset." },
        end: { type: Type.STRING, description: "ISO 8601 with offset." },
        location: { type: Type.STRING },
        description: { type: Type.STRING },
      },
      required: ["eventId"],
    },
  },
  {
    name: "delete_event",
    description: "Delete an event. Get the eventId from list_events first.",
    parameters: {
      type: Type.OBJECT,
      properties: { eventId: { type: Type.STRING } },
      required: ["eventId"],
    },
  },
];

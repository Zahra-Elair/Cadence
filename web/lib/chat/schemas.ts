import { z } from "zod";
import type { ToolName } from "./types";

const isoDateTime = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: "must be an ISO 8601 datetime" });

export const listEventsSchema = z.object({
  timeMin: isoDateTime.describe("Start of the range, ISO 8601 with timezone offset."),
  timeMax: isoDateTime.describe("End of the range, ISO 8601 with timezone offset."),
});

export const recurrenceSchema = z
  .object({
    frequency: z.enum(["daily", "weekly", "monthly"]).describe("How often the event repeats."),
    interval: z.number().int().min(1).max(52).optional().describe("Repeat every N periods (default 1)."),
    weekdays: z
      .array(z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]))
      .optional()
      .describe('For weekly recurrence, the weekdays it lands on, e.g. ["MO","TU","WE","TH","FR"] for every weekday.'),
    until: isoDateTime.optional().describe("Inclusive end date of the series (ISO 8601). Use this OR count, not both."),
    count: z.number().int().min(1).max(365).optional().describe("Number of occurrences. Use this OR until, not both."),
  })
  .refine((r) => !(r.until !== undefined && r.count !== undefined), {
    message: "set only one of until or count",
    path: ["until"],
  });

export const createEventSchema = z
  .object({
    title: z.string().trim().min(1).describe("Event title."),
    start: isoDateTime.describe("ISO 8601 with offset. For a recurring event, this is the first occurrence."),
    end: isoDateTime.describe("ISO 8601 with offset. For a recurring event, this is the first occurrence's end."),
    location: z.string().optional(),
    description: z.string().optional(),
    recurrence: recurrenceSchema
      .optional()
      .describe("Set to make this a single repeating event instead of creating many separate events."),
  })
  .refine((a) => Date.parse(a.end) > Date.parse(a.start), {
    message: "end must be after start",
    path: ["end"],
  });

export const updateEventSchema = z
  .object({
    eventId: z.string().trim().min(1).describe("Id from list_events."),
    eventTitle: z.string().optional().describe("The target event's current human-readable title, shown in the confirmation prompt (not used to modify the event)."),
    title: z.string().optional(),
    start: isoDateTime.optional(),
    end: isoDateTime.optional(),
    location: z.string().optional(),
    description: z.string().optional(),
  })
  .refine(
    (a) => {
      if (a.start === undefined && a.end === undefined) return true;
      if (a.start === undefined || a.end === undefined) return false;
      return Date.parse(a.end) > Date.parse(a.start);
    },
    { message: "start and end must both be set and end after start when changing the time", path: ["end"] },
  );

export const deleteEventSchema = z.object({
  eventId: z.string().trim().min(1).describe("Id from list_events."),
  eventTitle: z.string().optional().describe("The event's current human-readable title, shown in the confirmation prompt (not used to perform the deletion)."),
});

const WRITE_SCHEMAS = {
  create_event: createEventSchema,
  update_event: updateEventSchema,
  delete_event: deleteEventSchema,
} as const;

export function validateWriteArgs(
  tool: ToolName,
  args: Record<string, unknown>,
): { ok: true } | { ok: false; error: string } {
  if (!Object.hasOwn(WRITE_SCHEMAS, tool)) return { ok: false, error: `unknown tool: ${tool}` };
  const schema: z.ZodTypeAny = WRITE_SCHEMAS[tool as keyof typeof WRITE_SCHEMAS];
  const r = schema.safeParse(args);
  if (r.success) return { ok: true };
  const issue = r.error.issues[0];
  if (!issue) return { ok: false, error: "invalid arguments" };
  return {
    ok: false,
    error: issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message,
  };
}

import { z } from "zod";
import type { ToolName } from "./types";

const isoDateTime = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: "must be an ISO 8601 datetime" });

export const listEventsSchema = z.object({
  timeMin: isoDateTime.describe("Start of the range, ISO 8601 with timezone offset."),
  timeMax: isoDateTime.describe("End of the range, ISO 8601 with timezone offset."),
});

export const createEventSchema = z
  .object({
    title: z.string().min(1).describe("Event title."),
    start: isoDateTime.describe("ISO 8601 with offset."),
    end: isoDateTime.describe("ISO 8601 with offset."),
    location: z.string().optional(),
    description: z.string().optional(),
  })
  .refine((a) => Date.parse(a.end) > Date.parse(a.start), {
    message: "end must be after start",
    path: ["end"],
  });

export const updateEventSchema = z
  .object({
    eventId: z.string().min(1).describe("Id from list_events."),
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
  eventId: z.string().min(1).describe("Id from list_events."),
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
  const schema = (WRITE_SCHEMAS as Record<string, z.ZodTypeAny>)[tool];
  if (!schema) return { ok: false, error: `unknown tool: ${tool}` };
  const r = schema.safeParse(args);
  if (r.success) return { ok: true };
  return { ok: false, error: r.error.issues[0]?.message ?? "invalid arguments" };
}

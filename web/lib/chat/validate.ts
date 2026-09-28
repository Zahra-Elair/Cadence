import type { ToolName } from "./types";

type Result = { ok: true } | { ok: false; error: string };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
function parseISO(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
}

export function validateWriteArgs(tool: ToolName, args: Record<string, unknown>): Result {
  if (tool === "delete_event") {
    return isNonEmptyString(args.eventId) ? { ok: true } : { ok: false, error: "eventId is required" };
  }
  if (tool === "create_event") {
    if (!isNonEmptyString(args.title)) return { ok: false, error: "title is required" };
    const s = parseISO(args.start);
    const e = parseISO(args.end);
    if (s === null) return { ok: false, error: "start must be an ISO 8601 datetime" };
    if (e === null) return { ok: false, error: "end must be an ISO 8601 datetime" };
    if (e <= s) return { ok: false, error: "end must be after start" };
    return { ok: true };
  }
  if (tool === "update_event") {
    if (!isNonEmptyString(args.eventId)) return { ok: false, error: "eventId is required" };
    if (args.start !== undefined || args.end !== undefined) {
      const s = parseISO(args.start);
      const e = parseISO(args.end);
      if (s === null || e === null) return { ok: false, error: "start and end must both be valid ISO datetimes when changing the time" };
      if (e <= s) return { ok: false, error: "end must be after start" };
    }
    return { ok: true };
  }
  return { ok: false, error: `unknown tool: ${tool}` };
}

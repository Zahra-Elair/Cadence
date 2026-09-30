import { describeRecurrence, type Recurrence } from "./recurrence";

export type ToolName = "list_events" | "create_event" | "update_event" | "delete_event";

export const WRITE_TOOLS: ToolName[] = ["create_event", "update_event", "delete_event"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Wall { y: number; mo: number; d: number; h: number; mi: number }

/**
 * Reads the wall-clock date/time AS WRITTEN in an ISO string. The model emits
 * the user's local time with their own offset, so displaying those digits
 * directly keeps the card in the user's timezone regardless of the server's.
 */
function parseWall(iso: unknown): Wall | null {
  if (typeof iso !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return null;
  return { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5] };
}

function fmtDay(p: Wall): string {
  const wd = WEEKDAYS[new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay()];
  return `${wd} ${p.d} ${MONTHS[p.mo - 1]}`;
}

function fmtTime(p: Wall, withMeridiem = true): string {
  const meridiem = p.h < 12 ? "AM" : "PM";
  const h12 = p.h % 12 === 0 ? 12 : p.h % 12;
  const mins = p.mi === 0 ? "" : `:${String(p.mi).padStart(2, "0")}`;
  return `${h12}${mins}${withMeridiem ? ` ${meridiem}` : ""}`;
}

/** e.g. "Wed 30 Sep, 5 – 6 PM" (same day) or "Wed 30 Sep 5 PM – Thu 1 Oct 9 AM". */
function fmtRange(startISO?: string, endISO?: string): string {
  const s = parseWall(startISO);
  if (!s) return typeof startISO === "string" ? startISO : "";
  const e = parseWall(endISO);
  if (!e) return `${fmtDay(s)}, ${fmtTime(s)}`;
  const sameDay = s.y === e.y && s.mo === e.mo && s.d === e.d;
  if (!sameDay) return `${fmtDay(s)} ${fmtTime(s)} – ${fmtDay(e)} ${fmtTime(e)}`;
  const sameMeridiem = s.h < 12 === e.h < 12;
  return `${fmtDay(s)}, ${fmtTime(s, !sameMeridiem)} – ${fmtTime(e)}`;
}

/** Human-readable one-liner for a write. `past` yields "Created/Updated/Deleted"
 *  for a completed-action trace; the default imperative is for confirm prompts. */
export function summarizeWrite(tool: ToolName, args: Record<string, unknown>, past = false): string {
  const a = args as Record<string, string>;
  if (tool === "create_event") {
    const base = `${past ? "Created" : "Create"} "${a.title}" · ${fmtRange(a.start, a.end)}`;
    const rec = (args as { recurrence?: Recurrence }).recurrence;
    return rec ? `${base} · ${describeRecurrence(rec)}` : base;
  }
  if (tool === "update_event") {
    const label = a.eventTitle ? `"${a.eventTitle}"` : "this event";
    const changes: string[] = [];
    if (a.title) changes.push(`rename to "${a.title}"`);
    if (a.start) changes.push(fmtRange(a.start, a.end));
    return `${past ? "Updated" : "Update"} ${label}${changes.length ? ` → ${changes.join(", ")}` : ""}`;
  }
  if (tool === "delete_event") return `${past ? "Deleted" : "Delete"} ${a.eventTitle ? `"${a.eventTitle}"` : "this event"}`;
  return tool;
}

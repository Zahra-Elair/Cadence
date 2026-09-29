export type ToolName = "list_events" | "create_event" | "update_event" | "delete_event";

export const WRITE_TOOLS: ToolName[] = ["create_event", "update_event", "delete_event"];

export interface PendingWrite {
  tool: "create_event" | "update_event" | "delete_event";
  args: Record<string, unknown>;
  toolCallId: string;
  summary: string;
}

function fmt(iso: unknown): string {
  if (typeof iso !== "string") return String(iso ?? "");
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function summarizeWrite(tool: ToolName, args: Record<string, unknown>): string {
  const a = args as Record<string, string>;
  if (tool === "create_event") return `Create "${a.title}" · ${fmt(a.start)} – ${fmt(a.end)}`;
  if (tool === "update_event") {
    const label = a.eventTitle ? `"${a.eventTitle}"` : "this event";
    const changes: string[] = [];
    if (a.title) changes.push(`rename to "${a.title}"`);
    if (a.start) changes.push(`${fmt(a.start)}${a.end ? ` – ${fmt(a.end)}` : ""}`);
    return `Update ${label}${changes.length ? ` → ${changes.join(", ")}` : ""}`;
  }
  if (tool === "delete_event") return `Delete ${a.eventTitle ? `"${a.eventTitle}"` : "this event"}`;
  return tool;
}

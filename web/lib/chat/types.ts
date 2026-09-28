export type ToolName = "list_events" | "create_event" | "update_event" | "delete_event";

export const WRITE_TOOLS: ToolName[] = ["create_event", "update_event", "delete_event"];

export interface Part {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

export interface ChatContent {
  role: "user" | "model";
  parts: Part[];
}

export interface PendingWrite {
  tool: "create_event" | "update_event" | "delete_event";
  args: Record<string, unknown>;
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
    const when = a.start ? ` · ${fmt(a.start)}${a.end ? ` – ${fmt(a.end)}` : ""}` : "";
    return `Update event ${a.eventId}${a.title ? ` → "${a.title}"` : ""}${when}`;
  }
  if (tool === "delete_event") return `Delete event ${a.eventId}`;
  return tool;
}

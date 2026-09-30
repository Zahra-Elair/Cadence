"use client";
import type { ToolName } from "@/lib/chat/types";
import { summarizeWrite } from "@/lib/chat/types";
import { Check, X, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/** A persistent one-line record of a completed write, rendered from the actual
 *  tool result (not the model's narration) so the chat keeps an honest trail of
 *  what was created, updated, deleted, cancelled, or failed. */
export function WriteTrace({ tool, input, output }: {
  tool: ToolName; input: Record<string, unknown>; output: unknown;
}) {
  const o = (output ?? {}) as { declined?: boolean; error?: string };
  const status = o.declined ? "cancelled" : o.error ? "failed" : "done";

  const label =
    status === "cancelled"
      ? `Cancelled — ${summarizeWrite(tool, input)}`
      : status === "failed"
        ? `Couldn't complete — ${summarizeWrite(tool, input)}${o.error ? `: ${o.error}` : ""}`
        : summarizeWrite(tool, input, true);

  const Icon = status === "done" ? Check : status === "cancelled" ? X : TriangleAlert;

  return (
    <div
      className={cn(
        "flex items-start gap-1.5 text-xs",
        status === "failed" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", status === "done" && "text-primary")} />
      <span>{label}</span>
    </div>
  );
}

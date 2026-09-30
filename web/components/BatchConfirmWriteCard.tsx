"use client";
import type { ToolName } from "@/lib/chat/types";
import { summarizeWrite } from "@/lib/chat/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface WriteItem {
  tool: ToolName;
  toolCallId: string;
  args: Record<string, unknown>;
}

/** One card confirming several pending writes at once (e.g. "add work every
 *  weekday"). Each item is still listed so the user sees exactly what a single
 *  "Confirm all" approves. */
export function BatchConfirmWriteCard({ items, busy, onConfirmAll, onCancelAll }: {
  items: WriteItem[]; busy: boolean; onConfirmAll: () => void; onCancelAll: () => void;
}) {
  const hasDelete = items.some((it) => it.tool === "delete_event");
  return (
    <Card className={cn(hasDelete ? "border-destructive/40" : "border-primary/40")}>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-medium">Confirm {items.length} changes</p>
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it.toolCallId} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span
                className={cn(
                  "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                  it.tool === "delete_event" ? "bg-destructive" : "bg-primary",
                )}
              />
              <span>{summarizeWrite(it.tool, it.args)}</span>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Button size="sm" variant={hasDelete ? "destructive" : "default"} onClick={onConfirmAll} disabled={busy}>
            {busy ? "Working…" : `Confirm all ${items.length}`}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancelAll} disabled={busy}>
            Cancel all
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

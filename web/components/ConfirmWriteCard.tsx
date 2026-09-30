"use client";
import type { ToolName } from "@/lib/chat/types";
import { summarizeWrite } from "@/lib/chat/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConfirmWriteCard({ tool, args, busy, onConfirm, onCancel }: {
  tool: ToolName; args: Record<string, unknown>; busy: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const danger = tool === "delete_event";
  const verb = tool === "create_event" ? "create" : tool === "update_event" ? "update" : "delete";
  return (
    <Card className={cn(danger ? "border-destructive/40" : "border-primary/40")}>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-medium">{summarizeWrite(tool, args)}</p>
        <div className="flex gap-2">
          <Button size="sm" variant={danger ? "destructive" : "default"} onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : `Confirm ${verb}`}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

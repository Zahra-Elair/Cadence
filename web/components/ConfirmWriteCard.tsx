"use client";
import type { PendingWrite } from "@/lib/chat/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConfirmWriteCard({ pending, busy, onConfirm, onCancel }: {
  pending: PendingWrite; busy: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const verb = pending.tool === "delete_event" ? "Delete" : pending.tool === "update_event" ? "Update" : "Create";
  const danger = pending.tool === "delete_event";
  return (
    <Card className={cn(danger ? "border-destructive/40" : "border-primary/40")}>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-medium">{pending.summary}</p>
        <div className="flex gap-2">
          <Button size="sm" variant={danger ? "destructive" : "default"} onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : `Confirm ${verb.toLowerCase()}`}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

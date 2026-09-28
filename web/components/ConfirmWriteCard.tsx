"use client";
import type { PendingWrite } from "@/lib/chat/types";

export function ConfirmWriteCard({ pending, busy, onConfirm, onCancel }: {
  pending: PendingWrite; busy: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const verb = pending.tool === "delete_event" ? "Delete" : pending.tool === "update_event" ? "Update" : "Create";
  const danger = pending.tool === "delete_event";
  return (
    <div className={`rounded-xl border p-4 ${danger ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50"}`}>
      <p className="mb-3 text-sm text-gray-800">🗓️ {pending.summary}</p>
      <div className="flex gap-2">
        <button onClick={onConfirm} disabled={busy}
          className={`rounded-lg px-4 py-1.5 text-sm text-white disabled:opacity-50 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-black hover:bg-gray-800"}`}>
          {busy ? "Working…" : `Confirm ${verb.toLowerCase()}`}
        </button>
        <button onClick={onCancel} disabled={busy} className="rounded-lg border px-4 py-1.5 text-sm hover:bg-gray-100">
          Cancel
        </button>
      </div>
    </div>
  );
}

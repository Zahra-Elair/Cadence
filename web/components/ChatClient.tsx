"use client";
import { useState } from "react";
import type { ChatContent, PendingWrite } from "@/lib/chat/types";
import { sendChatMessage, confirmWrite, declineWrite, type ChatResult } from "@/lib/chat-actions";
import { ConfirmWriteCard } from "./ConfirmWriteCard";

interface Bubble { role: "user" | "assistant"; text: string }

function bubblesFrom(history: ChatContent[]): Bubble[] {
  const out: Bubble[] = [];
  for (const c of history) {
    const text = c.parts.map((p) => p.text ?? "").join("").trim();
    if (!text) continue;
    out.push({ role: c.role === "user" ? "user" : "assistant", text });
  }
  return out;
}

export function ChatClient() {
  const zone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const [history, setHistory] = useState<ChatContent[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<PendingWrite | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function apply(res: ChatResult) {
    if (!res.ok) { setError(res.error); return; }
    setError(null);
    setHistory(res.history);
    setPending(res.pending ?? null);
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...history, { role: "user" as const, parts: [{ text }] }];
    setHistory(next); setInput(""); setBusy(true);
    apply(await sendChatMessage(next, zone));
    setBusy(false);
  }

  async function onConfirm() {
    if (!pending) return;
    setBusy(true);
    apply(await confirmWrite(history, pending, zone));
    setBusy(false);
  }
  async function onCancel() {
    if (!pending) return;
    setBusy(true);
    apply(await declineWrite(history, pending, zone));
    setBusy(false);
  }

  const bubbles = bubblesFrom(history);
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-3">
        {bubbles.map((b, i) => (
          <div key={i} className={b.role === "user" ? "text-right" : "text-left"}>
            <span className={`inline-block max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${b.role === "user" ? "bg-black text-white" : "bg-gray-100 text-gray-900"}`}>
              {b.text}
            </span>
          </div>
        ))}
        {pending && <ConfirmWriteCard pending={pending} busy={busy} onConfirm={onConfirm} onCancel={onCancel} />}
        {busy && !pending && <p className="text-sm text-gray-400">Thinking…</p>}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} disabled={busy || !!pending}
          placeholder="e.g. add lunch with Sam Thursday at 1pm"
          className="flex-1 rounded-lg border px-3 py-2 text-sm disabled:bg-gray-50" />
        <button type="submit" disabled={busy || !!pending || !input.trim()}
          className="rounded-lg bg-black px-5 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50">
          Send
        </button>
      </form>
      {pending && <p className="text-xs text-gray-400">Confirm or cancel the pending action to continue.</p>}
    </div>
  );
}

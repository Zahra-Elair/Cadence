"use client";
import { useState } from "react";
import type { ModelMessage } from "ai";
import type { PendingWrite } from "@/lib/chat/types";
import { sendChatMessage, confirmWrite, declineWrite, type ChatResult } from "@/lib/chat-actions";
import { ConfirmWriteCard } from "./ConfirmWriteCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";

interface Bubble { role: "user" | "assistant"; text: string }

function textOf(content: ModelMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .map((p) => ("text" in p && typeof (p as { text?: unknown }).text === "string" ? (p as { text: string }).text : ""))
    .join("")
    .trim();
}

function bubblesFrom(messages: ModelMessage[]): Bubble[] {
  const out: Bubble[] = [];
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") continue; // skip tool messages
    const text = textOf(m.content);
    if (!text) continue;
    out.push({ role: m.role, text });
  }
  return out;
}

export function ChatClient() {
  const zone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const [messages, setMessages] = useState<ModelMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<PendingWrite | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function apply(res: ChatResult) {
    if (!res.ok) { setError(res.error); return; }
    setError(null);
    setMessages(res.messages);
    setPending(res.pending ?? null);
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next: ModelMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next); setInput(""); setBusy(true);
    apply(await sendChatMessage(next, zone));
    setBusy(false);
  }

  async function onConfirm() {
    if (!pending) return;
    setBusy(true);
    const res = await confirmWrite(messages, pending, zone);
    setPending(null);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setError(null);
    setMessages(res.messages);
  }
  async function onCancel() {
    if (!pending) return;
    setBusy(true);
    const res = await declineWrite(messages, pending, zone);
    setPending(null);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setError(null);
    setMessages(res.messages);
  }

  const bubbles = bubblesFrom(messages);
  return (
    <div className="flex flex-col gap-4">
      <ScrollArea className="h-[60vh] rounded-xl border p-4">
        {bubbles.length === 0 && !busy && (
          <p className="py-16 text-center text-sm text-muted-foreground">Ask about your schedule — e.g. "what's on today?" or "add lunch with Sam Thursday at 1pm".</p>
        )}
        <div className="space-y-3">
          {bubbles.map((b, i) => (
            <div key={i} className={cn("flex", b.role === "user" ? "justify-end" : "justify-start")}>
              <span className={cn("inline-block max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm",
                b.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                {b.text}
              </span>
            </div>
          ))}
          {pending && <ConfirmWriteCard pending={pending} busy={busy} onConfirm={onConfirm} onCancel={onCancel} />}
          {busy && !pending && <p className="text-sm text-muted-foreground">Thinking…</p>}
        </div>
      </ScrollArea>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} disabled={busy || !!pending}
          placeholder="Message the assistant…" />
        <Button type="submit" size="icon" disabled={busy || !!pending || !input.trim()} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </form>
      {pending && <p className="text-xs text-muted-foreground">Confirm or cancel the pending action to continue.</p>}
    </div>
  );
}

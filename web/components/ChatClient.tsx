"use client";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  isToolUIPart,
  getToolName,
  type UIMessage,
  type ToolUIPart,
} from "ai";
import { signIn } from "next-auth/react";
import { ConfirmWriteCard } from "./ConfirmWriteCard";
import { Markdown } from "./Markdown";
import { WRITE_TOOLS, type ToolName } from "@/lib/chat/types";
import { executeWrite } from "@/lib/chat-actions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";

// Created once: the per-send body (timeZone) is supplied on each sendMessage call.
const transport = new DefaultChatTransport({ api: "/api/chat" });

const isWriteTool = (name: string): name is ToolName => (WRITE_TOOLS as string[]).includes(name);

function looksLikeAuthError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("sign in") || m.includes("session expired") || m.includes("session or calendar permission");
}

export function ChatClient() {
  const zone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const [input, setInput] = useState("");
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // sendAutomaticallyWhen is REQUIRED: after addToolOutput records the confirmed
  // write result, this resubmits the conversation so the assistant streams its
  // follow-up narration. Without it, nothing continues after a confirm.
  const { messages, sendMessage, addToolOutput, status, error } = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  const busy = status === "submitted" || status === "streaming";

  const pendingWrite = messages.some((m) =>
    m.parts.some((p) => isToolUIPart(p) && p.state === "input-available" && isWriteTool(getToolName(p))),
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, pendingWrite]);

  useEffect(() => {
    if (error && looksLikeAuthError(error.message)) setNeedsSignIn(true);
  }, [error]);

  async function onConfirm(tool: ToolName, toolCallId: string, args: Record<string, unknown>) {
    setConfirmBusy(true);
    const res = await executeWrite(tool, args);
    setConfirmBusy(false);
    if (!res.ok && res.needsSignIn) setNeedsSignIn(true);
    // Record the result on the tool call. With sendAutomaticallyWhen set, this
    // resubmits so the assistant narrates the outcome. A confirmed write is never
    // re-prompted: the part leaves input-available once output is recorded.
    await addToolOutput({ tool, toolCallId, output: res.ok ? res.output : { error: res.error } });
  }

  async function onCancel(tool: ToolName, toolCallId: string) {
    await addToolOutput({ tool, toolCallId, output: { declined: true, note: "The user declined this action." } });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy || pendingWrite) return;
    setInput("");
    setNeedsSignIn(false);
    void sendMessage({ text }, { body: { timeZone: zone } });
  }

  return (
    <div className="flex flex-col gap-4">
      <ScrollArea className="h-[60vh] rounded-xl border p-4">
        {messages.length === 0 && !busy && (
          <p className="py-16 text-center text-sm text-muted-foreground">{`Ask about your schedule — e.g. "what's on today?" or "add lunch with Sam Thursday at 1pm".`}</p>
        )}
        <div className="space-y-3">
          {messages.map((m: UIMessage) => (
            <div key={m.id} className="space-y-2">
              {m.parts.map((part, i) => {
                if (part.type === "text") {
                  return (
                    <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                      {m.role === "user" ? (
                        <span className="inline-block max-w-[80%] whitespace-pre-wrap break-words rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">
                          {part.text}
                        </span>
                      ) : (
                        <div className="max-w-[80%] overflow-x-auto rounded-2xl bg-muted px-4 py-2 text-sm text-foreground">
                          <Markdown>{part.text}</Markdown>
                        </div>
                      )}
                    </div>
                  );
                }
                if (isToolUIPart(part) && part.state === "input-available") {
                  const name = getToolName(part);
                  if (isWriteTool(name)) {
                    const write = part as ToolUIPart;
                    return (
                      <ConfirmWriteCard
                        key={i}
                        tool={name}
                        args={(write.input ?? {}) as Record<string, unknown>}
                        busy={confirmBusy}
                        onConfirm={() => onConfirm(name, write.toolCallId, (write.input ?? {}) as Record<string, unknown>)}
                        onCancel={() => onCancel(name, write.toolCallId)}
                      />
                    );
                  }
                }
                return null;
              })}
            </div>
          ))}
          {busy && !pendingWrite && <p className="text-sm text-muted-foreground">Thinking…</p>}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{error.message}</span>
            {needsSignIn && (
              <Button size="sm" onClick={() => signIn("google", { redirectTo: "/dashboard" })}>Sign in with Google</Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      {!error && needsSignIn && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>Your Google session or calendar permission needs a refresh.</span>
            <Button size="sm" onClick={() => signIn("google", { redirectTo: "/dashboard" })}>Sign in with Google</Button>
          </AlertDescription>
        </Alert>
      )}
      <form onSubmit={submit} className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} disabled={busy || pendingWrite}
          placeholder="Message the assistant…" />
        <Button type="submit" size="icon" disabled={busy || pendingWrite || !input.trim()} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </form>
      {pendingWrite && <p className="text-xs text-muted-foreground">Confirm or cancel the pending action to continue.</p>}
    </div>
  );
}

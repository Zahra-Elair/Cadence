"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { BatchConfirmWriteCard, type WriteItem } from "./BatchConfirmWriteCard";
import { WriteTrace } from "./WriteTrace";
import { Markdown } from "./Markdown";
import { WRITE_TOOLS, type ToolName } from "@/lib/chat/types";
import { executeWrite } from "@/lib/chat-actions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { Send, Sparkles } from "lucide-react";

const isWriteTool = (name: string): name is ToolName => (WRITE_TOOLS as string[]).includes(name);

const SUGGESTIONS = [
  "What's on today?",
  "Summarize my week",
  "Add lunch with Sam Thursday at 1pm",
  "Clear Friday afternoon",
];

/** All write tool calls in a message still awaiting the user's confirmation. */
function pendingWrites(m: UIMessage): WriteItem[] {
  return m.parts.flatMap((p) => {
    if (!isToolUIPart(p) || p.state !== "input-available") return [];
    const name = getToolName(p);
    if (!isWriteTool(name)) return [];
    const w = p as ToolUIPart;
    return [{ tool: name, toolCallId: w.toolCallId, args: (w.input ?? {}) as Record<string, unknown> }];
  });
}

function looksLikeAuthError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("sign in") || m.includes("session expired") || m.includes("session or calendar permission");
}

function AssistantAvatar() {
  return (
    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
      <Sparkles className="h-4 w-4" />
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
      {["0s", "0.15s", "0.3s"].map((d) => (
        <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: d }} />
      ))}
    </div>
  );
}

export function ChatClient({ viewContext, onWriteComplete }: {
  viewContext?: { weekStartISO?: string; selectedDayISO?: string };
  onWriteComplete?: () => void;
} = {}) {
  const zone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const [input, setInput] = useState("");
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // timeZone rides the transport body so EVERY request carries it — including the
  // sendAutomaticallyWhen-triggered resubmit after addToolOutput, which sends no
  // per-call options. useMemo keyed on zone keeps the transport identity stable.
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { timeZone: zone, viewContext } }),
    [zone, viewContext?.weekStartISO, viewContext?.selectedDayISO],
  );

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
    const res = await executeWrite(tool, args, zone);
    setConfirmBusy(false);
    if (!res.ok && res.needsSignIn) setNeedsSignIn(true);
    // Record the result on the tool call. With sendAutomaticallyWhen set, this
    // resubmits so the assistant narrates the outcome. A confirmed write is never
    // re-prompted: the part leaves input-available once output is recorded.
    await addToolOutput({ tool, toolCallId, output: res.ok ? res.output : { error: res.error } });
    onWriteComplete?.();
  }

  async function onCancel(tool: ToolName, toolCallId: string) {
    await addToolOutput({ tool, toolCallId, output: { declined: true, note: "The user declined this action." } });
  }

  // Batch confirm: run each write in order and record its result. Only the last
  // addToolOutput completes the message's tool calls, so the auto-resend fires
  // once. A failed write still records its error and the rest continue; the
  // assistant's follow-up (which re-lists to verify) reports the real outcome.
  async function onConfirmAll(items: WriteItem[]) {
    setConfirmBusy(true);
    for (const it of items) {
      const res = await executeWrite(it.tool, it.args, zone);
      if (!res.ok && res.needsSignIn) setNeedsSignIn(true);
      await addToolOutput({ tool: it.tool, toolCallId: it.toolCallId, output: res.ok ? res.output : { error: res.error } });
    }
    setConfirmBusy(false);
    onWriteComplete?.();
  }

  async function onCancelAll(items: WriteItem[]) {
    for (const it of items) {
      await addToolOutput({ tool: it.tool, toolCallId: it.toolCallId, output: { declined: true, note: "The user declined this action." } });
    }
  }

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || pendingWrite) return;
    setInput("");
    setNeedsSignIn(false);
    void sendMessage({ text: trimmed });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  const empty = messages.length === 0 && !busy;

  return (
    <div className="flex h-[70vh] flex-col">
      <ScrollArea className="min-h-0 flex-1 py-5">
        {empty ? (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-5 px-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-medium">How can I help with your calendar?</p>
              <p className="text-sm text-muted-foreground">Ask about your schedule, or tell me what to add, move, or clear.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m: UIMessage) => {
              const writes = pendingWrites(m);
              const isUser = m.role === "user";
              return (
                <div key={m.id} className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
                  {!isUser && <AssistantAvatar />}
                  <div className={cn("flex min-w-0 max-w-[85%] flex-col gap-2", isUser ? "items-end" : "items-start")}>
                    {m.parts.map((part, i) => {
                      if (part.type === "text") {
                        return isUser ? (
                          <span key={i} className="inline-block whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
                            {part.text}
                          </span>
                        ) : (
                          <div key={i} className="max-w-full overflow-x-auto rounded-2xl rounded-tl-sm bg-muted px-4 py-2 text-sm text-foreground">
                            <Markdown>{part.text}</Markdown>
                          </div>
                        );
                      }
                      // A resolved write leaves a permanent, factual trace in the chat,
                      // rendered from the tool's actual result rather than the model's words.
                      if (isToolUIPart(part) && part.state === "output-available") {
                        const name = getToolName(part);
                        if (isWriteTool(name)) {
                          const w = part as ToolUIPart;
                          return (
                            <WriteTrace key={i} tool={name} input={(w.input ?? {}) as Record<string, unknown>} output={w.output} />
                          );
                        }
                      }
                      return null;
                    })}
                    {writes.length === 1 && (
                      <ConfirmWriteCard
                        tool={writes[0].tool}
                        args={writes[0].args}
                        busy={confirmBusy}
                        onConfirm={() => onConfirm(writes[0].tool, writes[0].toolCallId, writes[0].args)}
                        onCancel={() => onCancel(writes[0].tool, writes[0].toolCallId)}
                      />
                    )}
                    {writes.length > 1 && (
                      <BatchConfirmWriteCard
                        items={writes}
                        busy={confirmBusy}
                        onConfirmAll={() => onConfirmAll(writes)}
                        onCancelAll={() => onCancelAll(writes)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
            {busy && !pendingWrite && (
              <div className="flex justify-start gap-3">
                <AssistantAvatar />
                <TypingDots />
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      <div className="space-y-3 pt-3">
        {error && (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{error.message}</span>
              {needsSignIn && (
                <Button size="sm" onClick={() => signIn("google", { redirectTo: "/app" })}>Sign in with Google</Button>
              )}
            </AlertDescription>
          </Alert>
        )}
        {!error && needsSignIn && (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>Your Google session or calendar permission needs a refresh.</span>
              <Button size="sm" onClick={() => signIn("google", { redirectTo: "/app" })}>Sign in with Google</Button>
            </AlertDescription>
          </Alert>
        )}
        <form onSubmit={submit} className="relative">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy || pendingWrite}
            placeholder="Message Cadence…"
            className="h-12 rounded-full pr-12"
          />
          <Button
            type="submit"
            size="icon"
            disabled={busy || pendingWrite || !input.trim()}
            aria-label="Send"
            className="absolute right-1.5 top-1.5 h-9 w-9 rounded-full"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        {pendingWrite && <p className="text-center text-xs text-muted-foreground">Confirm or cancel the pending action to continue.</p>}
      </div>
    </div>
  );
}

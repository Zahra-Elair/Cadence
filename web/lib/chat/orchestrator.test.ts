import { describe, it, expect, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { tool, type ModelMessage, type ToolSet } from "ai";
import { z } from "zod";
import { runTurn, continueAfterToolResult, type TurnDeps } from "./orchestrator";

const userMsg = (t: string): ModelMessage[] => [{ role: "user", content: t }];

// A mock model that returns a scripted sequence of doGenerate results, one per call.
function scriptedModel(results: Array<Record<string, unknown>>) {
  let i = 0;
  return new MockLanguageModelV4({
    doGenerate: async () => results[Math.min(i++, results.length - 1)] as never,
  });
}

// v7 (LanguageModelV4) usage/finishReason shapes: usage is nested, finishReason is an object.
const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};
const textResult = (text: string) => ({
  content: [{ type: "text", text }],
  finishReason: { unified: "stop", raw: "stop" },
  usage,
  warnings: [],
});
const toolCallResult = (toolName: string, input: unknown, toolCallId = "call-1") => ({
  content: [{ type: "tool-call", toolCallId, toolName, input: JSON.stringify(input) }],
  finishReason: { unified: "tool-calls", raw: "tool-calls" },
  usage,
  warnings: [],
});

function depsWith(model: MockLanguageModelV4, tools: ToolSet): TurnDeps {
  return { model, tools, system: "test system" };
}

describe("runTurn", () => {
  it("returns a plain text reply", async () => {
    const listExec = vi.fn();
    const tools: ToolSet = {
      list_events: tool({ inputSchema: z.object({ timeMin: z.string(), timeMax: z.string() }), execute: listExec }),
      create_event: tool({ inputSchema: z.object({ title: z.string(), start: z.string(), end: z.string() }) }),
    };
    const res = await runTurn(userMsg("hi"), depsWith(scriptedModel([textResult("Hello!")]), tools));
    expect(res.kind).toBe("reply");
    if (res.kind === "reply") expect(res.reply).toBe("Hello!");
    expect(listExec).not.toHaveBeenCalled();
  });

  it("auto-runs a read tool then returns the follow-up reply", async () => {
    const listExec = vi.fn(async () => ({ events: [{ id: "e1" }] }));
    const tools: ToolSet = {
      list_events: tool({ inputSchema: z.object({ timeMin: z.string(), timeMax: z.string() }), execute: listExec }),
    };
    const model = scriptedModel([
      toolCallResult("list_events", { timeMin: "a", timeMax: "b" }),
      textResult("You have 2 meetings."),
    ]);
    const res = await runTurn(userMsg("what's on?"), depsWith(model, tools));
    expect(listExec).toHaveBeenCalledOnce();
    expect(res.kind).toBe("reply");
    if (res.kind === "reply") expect(res.reply).toContain("2 meetings");
  });

  it("returns a pending confirm for a valid write WITHOUT executing it", async () => {
    const tools: ToolSet = {
      create_event: tool({ inputSchema: z.object({ title: z.string(), start: z.string(), end: z.string() }) }),
    };
    const model = scriptedModel([
      toolCallResult("create_event", { title: "Lunch", start: "2026-09-25T13:00:00Z", end: "2026-09-25T14:00:00Z" }),
    ]);
    const res = await runTurn(userMsg("add lunch"), depsWith(model, tools));
    expect(res.kind).toBe("confirm");
    if (res.kind === "confirm") {
      expect(res.pending.tool).toBe("create_event");
      expect(res.pending.toolCallId).toBe("call-1");
      expect(res.pending.summary).toContain("Lunch");
    }
  });

  it("feeds an invalid-write error back and lets the model recover", async () => {
    const tools: ToolSet = {
      create_event: tool({ inputSchema: z.object({ title: z.string(), start: z.string(), end: z.string() }) }),
    };
    const model = scriptedModel([
      toolCallResult("create_event", { title: "X", start: "2026-09-25T14:00:00Z", end: "2026-09-25T13:00:00Z" }),
      textResult("What time should it start?"),
    ]);
    const res = await runTurn(userMsg("add x"), depsWith(model, tools));
    expect(res.kind).toBe("reply");
  });
});

describe("continueAfterToolResult", () => {
  it("appends the tool result and returns the model's follow-up", async () => {
    const tools: ToolSet = {
      create_event: tool({ inputSchema: z.object({ title: z.string() }) }),
    };
    const history: ModelMessage[] = [
      { role: "user", content: "add lunch" },
      { role: "assistant", content: [{ type: "tool-call", toolCallId: "call-1", toolName: "create_event", input: { title: "Lunch" } }] },
    ];
    const res = await continueAfterToolResult(history, "call-1", "create_event", { id: "new1" }, depsWith(scriptedModel([textResult("Done ✅")]), tools));
    expect(res.kind).toBe("reply");
    if (res.kind === "reply") expect(res.reply).toContain("Done");
  });
});

import { generateText, stepCountIs, type JSONValue, type ModelMessage, type LanguageModel, type ToolSet } from "ai";
import type { PendingWrite, ToolName } from "./types";
import { WRITE_TOOLS, summarizeWrite } from "./types";
import { validateWriteArgs } from "./schemas";

const MAX_STEPS = 8;
const MAX_CORRECTIONS = 2;

export interface TurnDeps {
  model: LanguageModel;
  tools: ToolSet;
  system: string;
}

export type TurnResult =
  | { kind: "reply"; messages: ModelMessage[]; reply: string }
  | { kind: "confirm"; messages: ModelMessage[]; pending: PendingWrite };

function toolResultMessage(toolCallId: string, toolName: string, output: unknown): ModelMessage {
  return {
    role: "tool",
    content: [{ type: "tool-result", toolCallId, toolName, output: { type: "json", value: output as JSONValue } }],
  };
}

async function loop(messages: ModelMessage[], deps: TurnDeps, correctionsLeft: number): Promise<TurnResult> {
  const result = await generateText({
    model: deps.model,
    system: deps.system,
    messages,
    tools: deps.tools,
    stopWhen: stepCountIs(MAX_STEPS),
  });
  const nextMessages = [...messages, ...result.response.messages];

  // Reads auto-execute inside generateText. Any tool call still unresolved here
  // is a write (no execute) that stopped the run.
  const writeCall = result.toolCalls.find((c) =>
    (WRITE_TOOLS as readonly string[]).includes(c.toolName),
  );

  if (writeCall) {
    const tool = writeCall.toolName as PendingWrite["tool"];
    const args = (writeCall.input ?? {}) as Record<string, unknown>;
    const check = validateWriteArgs(tool as ToolName, args);
    if (check.ok) {
      return {
        kind: "confirm",
        messages: nextMessages,
        pending: { tool, args, toolCallId: writeCall.toolCallId, summary: summarizeWrite(tool as ToolName, args) },
      };
    }
    if (correctionsLeft <= 0) {
      return { kind: "reply", messages: nextMessages, reply: "I couldn't build a valid change — could you rephrase?" };
    }
    const corrected = [...nextMessages, toolResultMessage(writeCall.toolCallId, tool, { error: check.error })];
    return loop(corrected, deps, correctionsLeft - 1);
  }

  return { kind: "reply", messages: nextMessages, reply: result.text ?? "" };
}

export function runTurn(messages: ModelMessage[], deps: TurnDeps): Promise<TurnResult> {
  return loop(messages, deps, MAX_CORRECTIONS);
}

export function continueAfterToolResult(
  messages: ModelMessage[],
  toolCallId: string,
  toolName: string,
  output: unknown,
  deps: TurnDeps,
): Promise<TurnResult> {
  return loop([...messages, toolResultMessage(toolCallId, toolName, output)], deps, MAX_CORRECTIONS);
}

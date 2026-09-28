import type { ChatContent, PendingWrite, ToolName } from "./types";
import { WRITE_TOOLS, summarizeWrite } from "./types";
import { validateWriteArgs } from "./validate";

export interface ModelResponse {
  text: string | null;
  functionCall: { name: string; args: Record<string, unknown> } | null;
}
export type GenerateFn = (history: ChatContent[]) => Promise<ModelResponse>;

export interface CalendarOps {
  listEvents(args: { timeMin: string; timeMax: string }): Promise<unknown>;
}

export type TurnResult =
  | { kind: "reply"; history: ChatContent[]; reply: string }
  | { kind: "confirm"; history: ChatContent[]; pending: PendingWrite };

const MAX_STEPS = 8;

function toolResult(name: string, response: Record<string, unknown>): ChatContent {
  return { role: "user", parts: [{ functionResponse: { name, response } }] };
}

async function loop(history: ChatContent[], generate: GenerateFn, cal: CalendarOps): Promise<TurnResult> {
  let contents = history;
  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await generate(contents);

    if (res.functionCall) {
      const { name, args } = res.functionCall;
      contents = [...contents, { role: "model", parts: [{ functionCall: { name, args } }] }];

      if ((WRITE_TOOLS as string[]).includes(name)) {
        const check = validateWriteArgs(name as ToolName, args);
        if (!check.ok) {
          contents = [...contents, toolResult(name, { error: check.error })];
          continue; // let the model correct itself
        }
        return {
          kind: "confirm",
          history: contents,
          pending: { tool: name as PendingWrite["tool"], args, summary: summarizeWrite(name as ToolName, args) },
        };
      }

      // read tool
      try {
        const result = await cal.listEvents(args as { timeMin: string; timeMax: string });
        contents = [...contents, toolResult(name, { events: result })];
      } catch (err) {
        contents = [...contents, toolResult(name, { error: (err as Error).message })];
      }
      continue;
    }

    const reply = res.text ?? "";
    contents = [...contents, { role: "model", parts: [{ text: reply }] }];
    return { kind: "reply", history: contents, reply };
  }
  return { kind: "reply", history: contents, reply: "I couldn't complete that — could you rephrase?" };
}

export function runTurn(history: ChatContent[], generate: GenerateFn, cal: CalendarOps): Promise<TurnResult> {
  return loop(history, generate, cal);
}

export function continueAfterToolResult(
  history: ChatContent[], toolName: string, response: Record<string, unknown>,
  generate: GenerateFn, cal: CalendarOps,
): Promise<TurnResult> {
  return loop([...history, toolResult(toolName, response)], generate, cal);
}

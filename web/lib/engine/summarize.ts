import { GoogleGenAI } from "@google/genai";
import type { CalEvent, Period, Summary } from "./types";
import { buildPrompt, parseResponse } from "./prompt";
import { SummarizerError, MissingApiKeyError, QuotaExceededError } from "./errors";

export { SummarizerError, MissingApiKeyError, QuotaExceededError } from "./errors";

export interface GenAILike {
  models: {
    generateContent(args: { model: string; contents: string; config?: unknown }): Promise<{ text?: string | null }>;
  };
}

const DEFAULT_MODEL = "gemini-3.8-flash";

function emptySummary(period: Period, startISO: string, endISO: string): Summary {
  return {
    period, start: startISO, end: endISO,
    overview: "Nothing scheduled for this period.",
    keyEvents: [], timeBreakdown: "0h scheduled", highlights: [], empty: true,
  };
}

function makeClient(): GenAILike {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new MissingApiKeyError(
      "GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey.",
    );
  }
  return new GoogleGenAI({ apiKey }) as unknown as GenAILike;
}

function statusOf(err: unknown): number | undefined {
  return (err as { status?: number; code?: number })?.status
    ?? (err as { code?: number })?.code;
}

/** A transient "model overloaded / high demand" (503) failure, worth one retry. */
function isOverload(err: unknown): boolean {
  if (statusOf(err) === 503) return true;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return msg.includes("overload") || msg.includes("high demand") || msg.includes("unavailable");
}

async function generateWithOverloadRetry(
  client: GenAILike, model: string, prompt: string, retryDelayMs: number,
): Promise<string | null | undefined> {
  const call = () =>
    client.models.generateContent({
      model, contents: prompt, config: { responseMimeType: "application/json" },
    });
  try {
    return (await call()).text;
  } catch (err) {
    if (!isOverload(err)) throw err;
    if (retryDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    return (await call()).text; // one retry; a second overload propagates to the caller
  }
}

export async function summarize(
  events: CalEvent[], period: Period, startISO: string, endISO: string,
  opts: { client?: GenAILike; model?: string; retryDelayMs?: number } = {},
): Promise<Summary> {
  if (events.length === 0) return emptySummary(period, startISO, endISO);

  const client = opts.client ?? makeClient();
  const model = opts.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const retryDelayMs = opts.retryDelayMs ?? 800;
  const prompt = buildPrompt(events, period, startISO, endISO);

  let text: string | null | undefined;
  try {
    text = await generateWithOverloadRetry(client, model, prompt, retryDelayMs);
  } catch (err: unknown) {
    if (statusOf(err) === 429) {
      throw new QuotaExceededError("Gemini free-tier quota/rate limit reached. Try again shortly.");
    }
    if (isOverload(err)) {
      throw new SummarizerError("Gemini is busy right now — please try again in a moment.");
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new SummarizerError(`Failed to reach Gemini: ${msg}`);
  }

  if (!text) throw new SummarizerError("Gemini returned an empty or blocked response.");
  return parseResponse(text, period, startISO, endISO);
}

import { generateObject, APICallError, RetryError, type LanguageModel } from "ai";
import { z } from "zod";
import type { CalEvent, Period, Summary } from "./types";
import { buildPrompt } from "./prompt";
import { SummarizerError, MissingApiKeyError, QuotaExceededError } from "./errors";
import { resolveModel, ProviderConfigError } from "../ai/provider";

export { SummarizerError, MissingApiKeyError, QuotaExceededError } from "./errors";

const summarySchema = z.object({
  overview: z.string(),
  keyEvents: z.array(z.string()),
  timeBreakdown: z.string(),
  highlights: z.array(z.string()),
});

function emptySummary(period: Period, startISO: string, endISO: string): Summary {
  return {
    period, start: startISO, end: endISO,
    overview: "Nothing scheduled for this period.",
    keyEvents: [], timeBreakdown: "0h scheduled", highlights: [], empty: true,
  };
}

function statusOf(err: unknown): number | undefined {
  // After the SDK's built-in retries are exhausted it wraps the real error in a RetryError.
  if (RetryError.isInstance(err)) return statusOf(err.lastError);
  if (APICallError.isInstance(err)) return err.statusCode;
  return (err as { statusCode?: number; status?: number; code?: number })?.statusCode
    ?? (err as { status?: number })?.status
    ?? (err as { code?: number })?.code;
}

function isOverload(err: unknown): boolean {
  if (statusOf(err) === 503) return true;
  if (RetryError.isInstance(err)) return isOverload(err.lastError);
  const m = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return m.includes("overload") || m.includes("high demand") || m.includes("unavailable");
}

export async function summarize(
  events: CalEvent[], period: Period, startISO: string, endISO: string,
  opts: { model?: LanguageModel } = {},
): Promise<Summary> {
  if (events.length === 0) return emptySummary(period, startISO, endISO);

  let model: LanguageModel;
  try {
    model = opts.model ?? resolveModel();
  } catch (err) {
    if (err instanceof ProviderConfigError) {
      throw new MissingApiKeyError(err.message);
    }
    throw err;
  }

  const prompt = buildPrompt(events, period, startISO, endISO);
  try {
    const { object } = await generateObject({ model, schema: summarySchema, prompt });
    return { period, start: startISO, end: endISO, ...object, empty: false };
  } catch (err: unknown) {
    if (statusOf(err) === 429) {
      throw new QuotaExceededError("Free-tier quota/rate limit reached. Try again shortly.");
    }
    if (isOverload(err)) {
      throw new SummarizerError("The summarizer is busy right now — please try again in a moment.");
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new SummarizerError(`Failed to generate the summary: ${msg}`);
  }
}

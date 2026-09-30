import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import type { CalEvent, Period, Summary } from "./types";
import { buildPrompt } from "./prompt";
import { SummarizerError, MissingApiKeyError, QuotaExceededError } from "./errors";
import { resolveModel, ProviderConfigError, GENERATION_PROVIDER_OPTIONS } from "../ai/provider";
import { isQuota, isOverload } from "../ai/errors";

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
    keyEvents: [], timeBreakdown: "0h scheduled", highlights: [], eventCount: 0, empty: true,
  };
}

export async function summarize(
  events: CalEvent[], period: Period, startISO: string, endISO: string,
  opts: { model?: LanguageModel; zone?: string } = {},
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

  const prompt = buildPrompt(events, period, startISO, endISO, opts.zone ?? "UTC");
  try {
    const { object } = await generateObject({ model, schema: summarySchema, prompt, providerOptions: GENERATION_PROVIDER_OPTIONS });
    return { period, start: startISO, end: endISO, ...object, eventCount: events.length, empty: false };
  } catch (err: unknown) {
    if (isQuota(err)) {
      throw new QuotaExceededError("Free-tier quota/rate limit reached. Try again shortly.");
    }
    if (isOverload(err)) {
      throw new SummarizerError("The summarizer is busy right now — please try again in a moment.");
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new SummarizerError(`Failed to generate the summary: ${msg}`);
  }
}

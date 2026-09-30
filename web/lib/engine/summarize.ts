import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { DateTime } from "luxon";
import type { CalEvent, Period, ScheduleEvent, Summary } from "./types";
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
    keyEvents: [], timeBreakdown: "0h scheduled", highlights: [], eventCount: 0, events: [], empty: true,
  };
}

/** Serialize events to the user's timezone (ISO with offset) for the schedule card. */
function toSchedule(events: CalEvent[], zone: string): ScheduleEvent[] {
  const iso = (d: Date) => {
    const dt = DateTime.fromJSDate(d).setZone(zone);
    return dt.isValid ? dt.toISO({ suppressMilliseconds: true })! : d.toISOString();
  };
  return events.map((e) => ({ title: e.title, start: iso(e.start), end: iso(e.end), allDay: e.allDay, location: e.location }));
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
    return { period, start: startISO, end: endISO, ...object, eventCount: events.length, events: toSchedule(events, opts.zone ?? "UTC"), empty: false };
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

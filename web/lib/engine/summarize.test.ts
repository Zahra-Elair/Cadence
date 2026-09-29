import { describe, it, expect } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { RetryError } from "ai";
import { summarize, SummarizerError, QuotaExceededError, MissingApiKeyError } from "./summarize";
import type { CalEvent } from "./types";

const oneEvent: CalEvent[] = [{
  title: "Standup", start: new Date("2026-09-22T09:00:00Z"),
  end: new Date("2026-09-22T09:15:00Z"), allDay: false, attendees: [],
}];

// v7 (LanguageModelV4) usage/finishReason shapes: usage is nested, finishReason is an object.
const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};
function objectModel(obj: unknown) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(obj) }],
      finishReason: { unified: "stop", raw: "stop" },
      usage,
      warnings: [],
    }) as never,
  });
}
function throwingModel(err: Error) {
  return new MockLanguageModelV4({ doGenerate: async () => { throw err; } });
}

describe("summarize", () => {
  it("empty events → empty summary, no model call", async () => {
    const s = await summarize([], "daily", "2026-09-22", "2026-09-23", { model: objectModel({}) });
    expect(s.empty).toBe(true);
    expect(s.overview.toLowerCase()).toContain("nothing");
  });

  it("returns a parsed summary from the model object", async () => {
    const model = objectModel({ overview: "Busy morning.", keyEvents: ["09:00 Standup"], timeBreakdown: "0.2h", highlights: [] });
    const s = await summarize(oneEvent, "daily", "2026-09-22", "2026-09-23", { model });
    expect(s.overview).toBe("Busy morning.");
    expect(s.keyEvents).toContain("09:00 Standup");
    expect(s.empty).toBe(false);
  });

  it("a 429 error → QuotaExceededError", async () => {
    const err = Object.assign(new Error("quota"), { statusCode: 429 });
    await expect(summarize(oneEvent, "daily", "2026-09-22", "2026-09-23", { model: throwingModel(err) }))
      .rejects.toBeInstanceOf(QuotaExceededError);
  });

  it("a 503 overload → friendly 'busy' SummarizerError", async () => {
    const err = Object.assign(new Error("The model is overloaded"), { statusCode: 503 });
    await expect(summarize(oneEvent, "daily", "2026-09-22", "2026-09-23", { model: throwingModel(err) }))
      .rejects.toThrow(/busy/i);
  });

  it("a RetryError wrapping a 429 → QuotaExceededError", async () => {
    const last = Object.assign(new Error("quota"), { statusCode: 429 });
    const err = new RetryError({ message: "retries exhausted", reason: "maxRetriesExceeded", errors: [last] });
    await expect(summarize(oneEvent, "daily", "2026-09-22", "2026-09-23", { model: throwingModel(err) }))
      .rejects.toBeInstanceOf(QuotaExceededError);
  });

  it("a RetryError wrapping a 503 → 'busy' SummarizerError", async () => {
    const last = Object.assign(new Error("The model is overloaded"), { statusCode: 503 });
    const err = new RetryError({ message: "retries exhausted", reason: "maxRetriesExceeded", errors: [last] });
    await expect(summarize(oneEvent, "daily", "2026-09-22", "2026-09-23", { model: throwingModel(err) }))
      .rejects.toThrow(/busy/i);
  });

  it("any other model error → SummarizerError", async () => {
    await expect(summarize(oneEvent, "daily", "2026-09-22", "2026-09-23", { model: throwingModel(new Error("boom")) }))
      .rejects.toBeInstanceOf(SummarizerError);
  });

  it("missing key and no injected model → MissingApiKeyError", async () => {
    const prev = process.env.GEMINI_API_KEY;
    const prevProvider = process.env.AI_PROVIDER;
    delete process.env.GEMINI_API_KEY;
    delete process.env.AI_PROVIDER;
    try {
      await expect(summarize(oneEvent, "daily", "2026-09-22", "2026-09-23")).rejects.toBeInstanceOf(MissingApiKeyError);
    } finally {
      if (prev !== undefined) process.env.GEMINI_API_KEY = prev;
      if (prevProvider !== undefined) process.env.AI_PROVIDER = prevProvider;
    }
  });
});

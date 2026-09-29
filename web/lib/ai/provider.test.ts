import { describe, it, expect, afterEach } from "vitest";
import { resolveModel, ProviderConfigError } from "./provider";

const ENV_KEYS = ["AI_PROVIDER", "AI_MODEL", "GEMINI_API_KEY", "GROQ_API_KEY", "MISTRAL_API_KEY", "OPENROUTER_API_KEY"];
const saved: Record<string, string | undefined> = {};

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});
function setEnv(env: Record<string, string | undefined>) {
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  for (const [k, v] of Object.entries(env)) if (v !== undefined) process.env[k] = v;
}

describe("resolveModel", () => {
  it("returns a model for the default google provider when the key is set", () => {
    setEnv({ GEMINI_API_KEY: "test-key" });
    const model = resolveModel();
    expect(model).toBeTruthy();
    // AI SDK v5 language models expose a modelId string.
    expect(typeof (model as { modelId?: unknown }).modelId).toBe("string");
  });

  it("uses the google default model id when AI_MODEL is unset", () => {
    setEnv({ GEMINI_API_KEY: "test-key" });
    expect((resolveModel() as { modelId: string }).modelId).toBe("gemini-flash-latest");
  });

  it("AI_MODEL overrides the default model id", () => {
    setEnv({ GEMINI_API_KEY: "test-key", AI_MODEL: "some-model" });
    expect((resolveModel() as { modelId: string }).modelId).toBe("some-model");
  });

  it("empty AI_PROVIDER falls back to google", () => {
    setEnv({ AI_PROVIDER: "", GEMINI_API_KEY: "test-key" });
    expect(() => resolveModel()).not.toThrow();
  });

  it("a prototype key as AI_PROVIDER yields unknown-provider", () => {
    setEnv({ AI_PROVIDER: "constructor", GEMINI_API_KEY: "x" });
    try {
      resolveModel();
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as ProviderConfigError).kind).toBe("unknown-provider");
    }
  });

  it("throws ProviderConfigError(missing-key) when the selected provider's key is absent", () => {
    setEnv({ AI_PROVIDER: "groq" }); // no GROQ_API_KEY
    try {
      resolveModel();
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderConfigError);
      expect((err as ProviderConfigError).kind).toBe("missing-key");
    }
  });

  it("throws ProviderConfigError(unknown-provider) for an unsupported provider", () => {
    setEnv({ AI_PROVIDER: "openai", GEMINI_API_KEY: "x" });
    try {
      resolveModel();
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderConfigError);
      expect((err as ProviderConfigError).kind).toBe("unknown-provider");
    }
  });
});

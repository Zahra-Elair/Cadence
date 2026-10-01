import { describe, it, expect, afterEach } from "vitest";
import { resolveVisionModel, ProviderConfigError } from "./provider";

const KEYS = ["VISION_PROVIDER", "VISION_MODEL", "OPENROUTER_API_KEY", "GEMINI_API_KEY"] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});
function clear() { for (const k of KEYS) delete process.env[k]; }

describe("resolveVisionModel", () => {
  it("defaults to OpenRouter and throws missing-key when OPENROUTER_API_KEY is unset", () => {
    clear();
    try {
      resolveVisionModel();
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderConfigError);
      expect((err as ProviderConfigError).kind).toBe("missing-key");
      expect((err as ProviderConfigError).provider).toBe("openrouter");
    }
  });

  it("returns a model when the default (OpenRouter) key is present", () => {
    clear();
    process.env.OPENROUTER_API_KEY = "test-key";
    expect(resolveVisionModel()).toBeDefined();
  });

  it("honors VISION_PROVIDER to switch providers", () => {
    clear();
    process.env.VISION_PROVIDER = "google";
    process.env.GEMINI_API_KEY = "test-key";
    expect(resolveVisionModel()).toBeDefined();
  });

  it("rejects an unknown VISION_PROVIDER", () => {
    clear();
    process.env.VISION_PROVIDER = "nope";
    try {
      resolveVisionModel();
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as ProviderConfigError).kind).toBe("unknown-provider");
    }
  });
});

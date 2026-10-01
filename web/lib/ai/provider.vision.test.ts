import { describe, it, expect, afterEach } from "vitest";
import { resolveVisionModel, ProviderConfigError } from "./provider";

const saved = process.env.GEMINI_API_KEY;
afterEach(() => {
  if (saved === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = saved;
});

describe("resolveVisionModel", () => {
  it("throws a missing-key ProviderConfigError when GEMINI_API_KEY is unset", () => {
    delete process.env.GEMINI_API_KEY;
    try {
      resolveVisionModel();
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderConfigError);
      expect((err as ProviderConfigError).kind).toBe("missing-key");
    }
  });

  it("returns a model when the key is present", () => {
    process.env.GEMINI_API_KEY = "test-key";
    const model = resolveVisionModel();
    expect(model).toBeDefined();
  });
});

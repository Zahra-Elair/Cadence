import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

export class ProviderConfigError extends Error {
  constructor(
    public readonly kind: "unknown-provider" | "missing-key",
    public readonly provider: string,
    message: string,
  ) {
    super(message);
    this.name = "ProviderConfigError";
  }
}

interface ProviderSpec {
  envKey: string;
  defaultModel: string;
  make: (apiKey: string, modelId: string) => LanguageModel;
}

const PROVIDERS: Record<string, ProviderSpec> = {
  google: {
    envKey: "GEMINI_API_KEY",
    defaultModel: "gemini-flash-latest",
    make: (apiKey, modelId) => createGoogleGenerativeAI({ apiKey })(modelId),
  },
  groq: {
    envKey: "GROQ_API_KEY",
    // Groq rotates its catalog; if this id is retired for your account, set
    // AI_MODEL to a current tool-capable model from https://console.groq.com/docs/models
    defaultModel: "openai/gpt-oss-120b",
    make: (apiKey, modelId) => createGroq({ apiKey })(modelId),
  },
  mistral: {
    envKey: "MISTRAL_API_KEY",
    defaultModel: "mistral-small-latest",
    make: (apiKey, modelId) => createMistral({ apiKey })(modelId),
  },
  openrouter: {
    envKey: "OPENROUTER_API_KEY",
    // Set AI_MODEL to a tool-capable :free id for chat.
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
    make: (apiKey, modelId) => createOpenRouter({ apiKey }).chat(modelId),
  },
};

export function resolveModel(): LanguageModel {
  const name = process.env.AI_PROVIDER?.trim() || "google";
  const spec = Object.hasOwn(PROVIDERS, name) ? PROVIDERS[name] : undefined;
  if (!spec) {
    throw new ProviderConfigError(
      "unknown-provider",
      name,
      `Unknown AI_PROVIDER "${name}". Supported: ${Object.keys(PROVIDERS).join(", ")}.`,
    );
  }
  const apiKey = process.env[spec.envKey];
  if (!apiKey) {
    throw new ProviderConfigError(
      "missing-key",
      name,
      `Missing ${spec.envKey} for AI_PROVIDER "${name}".`,
    );
  }
  const modelId = process.env.AI_MODEL?.trim() || spec.defaultModel;
  return spec.make(apiKey, modelId);
}

/** Default vision model per provider — must be BOTH multimodal AND tool-capable
 *  (it reads the image and calls create_event). Override with VISION_MODEL. */
// Free OpenRouter models that do BOTH image input AND tool calling. They share
// heavily rate-limited upstream pools, so we send the whole list as OpenRouter's
// `models` fallback array — it tries them in order and skips any that are
// rate-limited/unavailable, instead of betting on one. VISION_MODEL (if set) is
// tried first. Refresh from https://openrouter.ai/api/v1/models if these churn.
// OpenRouter caps the `models` fallback array at 3; keep three on distinct
// upstream providers for the best chance one is up.
const OPENROUTER_VISION_FALLBACKS = [
  "google/gemma-4-31b-it:free",
  "qwen/qwen3.8-27b:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
];

/** Default vision model for non-OpenRouter providers (single model). */
const DEFAULT_VISION_MODEL: Record<string, string> = {
  google: "gemini-flash-latest",
  mistral: "pixtral-12b-latest",
};

/**
 * A vision-capable model for messages that include an image, independent of the
 * text AI_PROVIDER — so text chat can stay on a text-only provider (e.g. Groq)
 * while images route here. Defaults to OpenRouter; override with VISION_PROVIDER
 * (google | mistral | openrouter) and VISION_MODEL. The model must support BOTH
 * images and tool calling.
 */
export function resolveVisionModel(): LanguageModel {
  const name = process.env.VISION_PROVIDER?.trim() || "openrouter";
  const spec = Object.hasOwn(PROVIDERS, name) ? PROVIDERS[name] : undefined;
  if (!spec) {
    throw new ProviderConfigError(
      "unknown-provider",
      name,
      `Unknown VISION_PROVIDER "${name}". Supported: ${Object.keys(PROVIDERS).join(", ")}.`,
    );
  }
  const apiKey = process.env[spec.envKey];
  if (!apiKey) {
    throw new ProviderConfigError(
      "missing-key",
      name,
      `Missing ${spec.envKey} for VISION_PROVIDER "${name}".`,
    );
  }
  const override = process.env.VISION_MODEL?.trim();
  if (name === "openrouter") {
    // Send a fallback basket so OpenRouter skips rate-limited free models.
    // OpenRouter allows at most 3 models in the fallback array.
    const models = [...new Set([override, ...OPENROUTER_VISION_FALLBACKS].filter(Boolean) as string[])].slice(0, 3);
    return createOpenRouter({ apiKey }).chat(models[0], { extraBody: { models } });
  }
  const modelId = override || DEFAULT_VISION_MODEL[name] || spec.defaultModel;
  return spec.make(apiKey, modelId);
}

/**
 * Provider-specific generation options, namespaced by provider (a provider
 * ignores keys that aren't its own). Groq's reasoning models (gpt-oss, qwen3)
 * otherwise emit their chain-of-thought inline into the reply; "hidden" keeps
 * the model reasoning internally but returns only the final answer. Pass this
 * as `providerOptions` on generateText / generateObject.
 */
export const GENERATION_PROVIDER_OPTIONS = {
  groq: { reasoningFormat: "hidden" },
};

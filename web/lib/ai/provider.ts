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
const DEFAULT_VISION_MODEL: Record<string, string> = {
  // Llama 4 Maverick: multimodal + tool calling, free tier on OpenRouter.
  openrouter: "meta-llama/llama-4-maverick:free",
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
  const modelId = process.env.VISION_MODEL?.trim() || DEFAULT_VISION_MODEL[name] || spec.defaultModel;
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

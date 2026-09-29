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
    defaultModel: "llama-3.3-70b-versatile",
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

import { createGoogle } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import {
  generateText,
  JSONParseError,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
  TypeValidationError,
  type LanguageModel,
} from "ai";
import { AgentOutput } from "./schema";

// Main AI → backup AI (Tech §5.8). Model ids come from config, so a renamed free model is a config change.

export const AI_TIMEOUT_MS = 15_000;

export type ProviderConfig = {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL: string;
};

type ProviderOptions = Parameters<typeof generateText>[0]["providerOptions"];

export type AgentProvider = {
  name: "google" | "groq";
  modelId: string;
  model: LanguageModel;
  providerOptions?: ProviderOptions;
};

/** Providers in the order they are tried. One with no key is left out. */
export function createProviders(cfg: ProviderConfig): AgentProvider[] {
  const providers: AgentProvider[] = [];
  if (cfg.GEMINI_API_KEY) {
    providers.push({
      name: "google",
      modelId: cfg.GEMINI_MODEL,
      model: createGoogle({ apiKey: cfg.GEMINI_API_KEY })(cfg.GEMINI_MODEL),
      // Measured on L09: ~1.8 s with minimal thinking vs 2–6 s (sometimes 11 s) on the default level.
      providerOptions: { google: { thinkingConfig: { thinkingLevel: "minimal" } } },
    });
  }
  if (cfg.GROQ_API_KEY) {
    providers.push({
      name: "groq",
      modelId: cfg.GROQ_MODEL,
      model: createGroq({ apiKey: cfg.GROQ_API_KEY })(cfg.GROQ_MODEL),
      // gpt-oss reasons by default (~500 tokens/run); low keeps us inside Groq's 8k tokens/min free limit.
      providerOptions: { groq: { reasoningEffort: "low" } },
    });
  }
  return providers;
}

export type ModelCall =
  | { ok: true; output: AgentOutput; latencyMs: number; inputTokens?: number; outputTokens?: number }
  | {
      ok: false;
      /** "invalid": the model answered but not in our shape (worth one retry). "unavailable": error, timeout, rate limit. */
      kind: "invalid" | "unavailable";
      error: string;
      latencyMs: number;
    };

export async function callModel(
  provider: AgentProvider,
  system: string,
  prompt: string,
  timeoutMs = AI_TIMEOUT_MS,
): Promise<ModelCall> {
  const started = Date.now();
  try {
    const result = await generateText({
      model: provider.model,
      system,
      prompt,
      output: Output.object({ schema: AgentOutput }),
      temperature: 0.3,
      maxRetries: 0,
      timeout: timeoutMs,
      providerOptions: provider.providerOptions,
    });
    return {
      ok: true,
      output: result.output,
      latencyMs: Date.now() - started,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
    };
  } catch (err) {
    const invalid =
      NoObjectGeneratedError.isInstance(err) ||
      NoOutputGeneratedError.isInstance(err) ||
      TypeValidationError.isInstance(err) ||
      JSONParseError.isInstance(err);
    return {
      ok: false,
      kind: invalid ? "invalid" : "unavailable",
      error: (err instanceof Error ? err.message : String(err)).slice(0, 300),
      latencyMs: Date.now() - started,
    };
  }
}

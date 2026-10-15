// Shared helpers for the Node scripts (eval, snapshot). Run with: npx tsx scripts/<name>.ts
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSampleLeads, parseCsv } from "../src/shared/sampleData";
import type { Company } from "../src/worker/agent/prompt";
import { createProviders, type AgentProvider, type ProviderConfig } from "../src/worker/agent/providers";

const root = fileURLToPath(new URL("../", import.meta.url));

export function readRoot(path: string): string {
  return readFileSync(`${root}${path}`, "utf8");
}

/** Reads .dev.vars (KEY=value lines) and the model names from wrangler.jsonc. */
export function loadConfig(): ProviderConfig {
  const vars: Record<string, string> = {};
  for (const line of readRoot(".dev.vars").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m) vars[m[1]!] = m[2]!;
  }
  const wrangler = readRoot("wrangler.jsonc");
  const model = (name: string) => wrangler.match(new RegExp(String.raw`"${name}":\s*"([^"]+)"`))?.[1] ?? "";
  return {
    GEMINI_API_KEY: vars.GEMINI_API_KEY || undefined,
    GEMINI_MODEL: vars.GEMINI_MODEL || model("GEMINI_MODEL"),
    GROQ_API_KEY: vars.GROQ_API_KEY || undefined,
    GROQ_MODEL: vars.GROQ_MODEL || model("GROQ_MODEL"),
  };
}

export function loadCompany(): Company {
  return JSON.parse(readRoot("data/company.json")) as Company;
}

export function loadSample(now: Date) {
  const chats = Object.fromEntries(
    readdirSync(`${root}data/chats`).map((f) => [f.replace(".txt", ""), readRoot(`data/chats/${f}`)]),
  );
  return buildSampleLeads(readRoot("data/leads.csv"), chats, now);
}

export function loadLabels(): Record<string, { tag: string; needs_reply: string; why: string }> {
  return Object.fromEntries(
    parseCsv(readRoot("data/labels.csv")).map((r) => [r.id!, { tag: r.tag!, needs_reply: r.needs_reply!, why: r.why! }]),
  );
}

/** Providers picked by --provider=google|groq (default: all with a key). */
export function pickProviders(args: string[]): AgentProvider[] {
  const only = flag(args, "provider");
  const all = createProviders(loadConfig());
  return only ? all.filter((p) => p.name === only) : all;
}

// Free tiers: Gemini 15 requests/min; Groq 8k tokens/min (~2.2k per call).
const MIN_GAP_MS: Record<AgentProvider["name"], number> = { google: 4_500, groq: 17_000 };
const lastCall: Partial<Record<AgentProvider["name"], number>> = {};

/** Waits so calls to each provider stay under its free-tier rate limit. */
export async function throttle(provider: AgentProvider): Promise<void> {
  const wait = (lastCall[provider.name] ?? 0) + MIN_GAP_MS[provider.name] - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall[provider.name] = Date.now();
}

export function flag(args: string[], name: string): string | undefined {
  return args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

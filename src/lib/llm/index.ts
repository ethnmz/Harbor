/**
 * The one place Harbor talks to a model. Swap providers by adding an adapter that
 * implements LlmProvider and selecting it with LLM_PROVIDER.
 */
import { anthropicProvider, isTransientLlmError } from "./anthropic";
import { simulatorProvider } from "./simulator";
import type { LlmProvider } from "./types";

export * from "./types";
export { simulatorProvider, isTransientLlmError };

export function getProvider(): LlmProvider {
  const choice = process.env.LLM_PROVIDER?.toLowerCase();
  if (choice === "simulated") return simulatorProvider;
  if (choice === "anthropic" || process.env.ANTHROPIC_API_KEY) return anthropicProvider;
  return simulatorProvider;
}

/** When the live model is unreachable mid-demo, finish the run on the simulator (clearly labelled). */
export function simulatorFallbackEnabled() {
  return process.env.HARBOR_SIMULATOR_FALLBACK !== "0";
}

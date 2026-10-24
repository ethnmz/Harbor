export type ModelInfo = {
  id: string;
  label: string;
  blurb: string;
  /** USD per million tokens. */
  inputPerM: number;
  outputPerM: number;
};

export const MODELS: ModelInfo[] = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", blurb: "Most reliable reasoning and tool use", inputPerM: 4, outputPerM: 20 },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", blurb: "Fast, capable everyday agent model", inputPerM: 2, outputPerM: 10 },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", blurb: "Lowest cost for high-volume, simple jobs", inputPerM: 0.1, outputPerM: 0.5 },
];

export const DEFAULT_MODEL = process.env.HARBOR_DEFAULT_MODEL || "claude-opus-5-5";

export function modelInfo(id: string): ModelInfo {
  return MODELS.find((m) => m.id === id) ?? { id, label: id, blurb: "", inputPerM: 4, outputPerM: 20 };
}

export function llmCost(model: string, inputTokens: number, outputTokens: number) {
  const m = modelInfo(model);
  return (inputTokens * m.inputPerM + outputTokens * m.outputPerM) / 1_000_000;
}

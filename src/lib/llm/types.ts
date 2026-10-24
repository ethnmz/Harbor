/**
 * Provider-neutral message format. Runs persist conversations in this shape so a
 * paused run can resume on whichever provider is configured. Assistant turns keep
 * the provider's raw content so they can be replayed verbatim (thinking blocks etc.).
 */
export type LlmBlock =
  | { type: "text"; text: string }
  | { type: "tool_call"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; toolCallId: string; content: string; isError?: boolean };

export type LlmMessage = {
  role: "user" | "assistant";
  content: LlmBlock[];
  raw?: unknown;
  rawProvider?: string;
};

export type LlmToolSpec = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type Effort = "low" | "medium" | "high";

export type ChatRequest = {
  model: string;
  system: string;
  messages: LlmMessage[];
  tools: LlmToolSpec[];
  effort?: Effort;
  maxTokens?: number;
};

export type StopReason = "end_turn" | "tool_use" | "max_tokens" | "refusal" | "other";

export type ChatResult = {
  content: LlmBlock[];
  raw?: unknown;
  stopReason: StopReason;
  refusalCategory?: string | null;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  provider: string;
};

export type JsonRequest = {
  model: string;
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  effort?: Effort;
};

export type JsonResult = {
  data: unknown;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  provider: string;
};

export interface LlmProvider {
  id: string;
  label: string;
  /** False for the offline simulator. */
  live: boolean;
  chat(req: ChatRequest): Promise<ChatResult>;
  json(req: JsonRequest): Promise<JsonResult>;
}

export function textOf(blocks: LlmBlock[]) {
  return blocks
    .filter((b): b is Extract<LlmBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

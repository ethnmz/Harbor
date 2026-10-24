import Anthropic from "@anthropic-ai/sdk";
import type { ChatRequest, ChatResult, JsonRequest, JsonResult, LlmBlock, LlmMessage, LlmProvider, StopReason } from "./types";

type BetaMessageParam = Anthropic.Beta.BetaMessageParam;
type BetaContentBlockParam = Anthropic.Beta.BetaContentBlockParam;
type BetaMessage = Anthropic.Beta.BetaMessage;

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 3, timeout: 90_000 });
  return client;
}

// Server-side fallback: if the model declines for policy reasons the API retries on
// Anthropic's recommended substitute inside the same call.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

function toAnthropicMessages(messages: LlmMessage[]): BetaMessageParam[] {
  return messages.map((m) => {
    if (m.role === "assistant" && m.rawProvider === "anthropic" && Array.isArray(m.raw)) {
      // Replay the exact content (including thinking blocks) the API returned.
      return { role: "assistant", content: m.raw as BetaContentBlockParam[] };
    }
    const content: BetaContentBlockParam[] = m.content.map((b) => {
      if (b.type === "text") return { type: "text", text: b.text };
      if (b.type === "tool_call") return { type: "tool_use", id: b.id, name: b.name, input: b.input };
      return { type: "tool_result", tool_use_id: b.toolCallId, content: b.content, is_error: b.isError ?? false };
    });
    return { role: m.role, content };
  });
}

function fromAnthropicContent(res: BetaMessage): LlmBlock[] {
  const out: LlmBlock[] = [];
  for (const block of res.content) {
    if (block.type === "text") out.push({ type: "text", text: block.text });
    else if (block.type === "tool_use") out.push({ type: "tool_call", id: block.id, name: block.name, input: block.input as Record<string, unknown> });
  }
  return out;
}

function mapStop(reason: BetaMessage["stop_reason"]): StopReason {
  switch (reason) {
    case "end_turn":
    case "tool_use":
    case "max_tokens":
    case "refusal":
      return reason;
    default:
      return "other";
  }
}

export const anthropicProvider: LlmProvider = {
  id: "anthropic",
  label: "Anthropic",
  live: true,

  async chat(req: ChatRequest): Promise<ChatResult> {
    const res = await getClient().beta.messages.create({
      model: req.model,
      max_tokens: req.maxTokens ?? 16000,
      system: req.system,
      messages: toAnthropicMessages(req.messages),
      tools: req.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Beta.BetaTool.InputSchema,
        strict: true,
      })),
      output_config: { effort: req.effort ?? "low" },
      betas: [FALLBACK_BETA],
      fallbacks: "default",
    });
    return {
      content: fromAnthropicContent(res),
      raw: res.content,
      stopReason: mapStop(res.stop_reason),
      refusalCategory: res.stop_reason === "refusal" ? (res.stop_details?.category ?? null) : undefined,
      usage: { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens },
      model: res.model,
      provider: "anthropic",
    };
  },

  async json(req: JsonRequest): Promise<JsonResult> {
    const res = await getClient().beta.messages.create({
      model: req.model,
      max_tokens: 16000,
      system: req.system,
      messages: [{ role: "user", content: req.prompt }],
      output_config: { effort: req.effort ?? "medium", format: { type: "json_schema", schema: req.schema } },
      betas: [FALLBACK_BETA],
      fallbacks: "default",
    });
    if (res.stop_reason === "refusal") throw new Error(`Model declined the request (${res.stop_details?.category ?? "policy"})`);
    if (res.stop_reason === "max_tokens") throw new Error("Model output was truncated (max_tokens)");
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return {
      data: JSON.parse(text),
      usage: { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens },
      model: res.model,
      provider: "anthropic",
    };
  },
};

/** Errors worth falling back to the simulator for (network, overload, rate limit). */
export function isTransientLlmError(e: unknown) {
  if (e instanceof Anthropic.RateLimitError) return true;
  if (e instanceof Anthropic.InternalServerError) return true;
  if (e instanceof Anthropic.APIConnectionError) return true;
  if (e instanceof Anthropic.APIError) return typeof e.status === "number" && e.status >= 500;
  return false;
}

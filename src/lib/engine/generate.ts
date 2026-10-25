import type { Workspace } from "../db/schema";
import { getProvider } from "../llm";
import { MODELS } from "../llm/models";
import { BUILTIN_TEMPLATES, DEFAULT_GUARDRAILS } from "../seed-data";
import { TOOLS, TOOL_NAMES } from "../tools";
import { enforcePolicy, type AgentConfig } from "./config";

export type GenerateResult = {
  config: AgentConfig;
  adjustments: string[];
  reasoning: string;
  provider: string;
  latencyMs: number;
};

const CONFIG_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "description", "instructions", "allowed_tools", "risky_tools_requiring_approval", "model", "guardrails", "reasoning"],
  properties: {
    name: { type: "string", description: "Short agent name, 2-4 words, Title Case" },
    description: { type: "string", description: "One sentence: what the agent does" },
    instructions: {
      type: "string",
      description: "Numbered, step-by-step instructions written to the agent in second person. Reference tools by name. End with calling finish_run.",
    },
    allowed_tools: { type: "array", items: { type: "string", enum: TOOL_NAMES } },
    risky_tools_requiring_approval: { type: "array", items: { type: "string", enum: TOOL_NAMES } },
    model: { type: "string", enum: MODELS.map((m) => m.id) },
    guardrails: {
      type: "object",
      additionalProperties: false,
      required: ["max_steps", "max_cost_usd", "max_refund_usd", "allowed_slack_channels", "extra_rules"],
      properties: {
        max_steps: { type: "integer" },
        max_cost_usd: { type: "number" },
        max_refund_usd: { type: "number" },
        allowed_slack_channels: { type: "array", items: { type: "string" } },
        extra_rules: { type: "array", items: { type: "string" }, description: "Rules specific to this agent, beyond company policy" },
      },
    },
    reasoning: { type: "string", description: "One or two sentences on why you chose these tools and guardrails" },
  },
};

type RawConfig = {
  name: string;
  description: string;
  instructions: string;
  allowed_tools: string[];
  risky_tools_requiring_approval: string[];
  model: string;
  guardrails: { max_steps: number; max_cost_usd: number; max_refund_usd: number; allowed_slack_channels: string[]; extra_rules: string[] };
  reasoning: string;
};

function workspaceBrief(ws: Workspace) {
  const p = ws.policies;
  return [
    `Company: ${ws.company}. Team lead: ${ws.ownerName}. Default model: ${ws.defaultModel}.`,
    ...(p.profile ? [`${ws.company} has ${p.profile.size} people${p.profile.kinds.length ? ` and describes itself as: ${p.profile.kinds.join(", ")}` : ""}.`] : []),
    "Connected tools (the only ones an agent may use):",
    ...TOOLS.map((t) => `- ${t.name} [${t.connection}]${p.approvalRequiredTools.includes(t.name) ? " (requires manager approval)" : ""}: ${t.description}`),
    "Company policy:",
    `- Max ${p.maxStepsPerRun} model steps and $${p.maxCostPerRunUsd} per run; refunds above $${p.maxRefundUsd} must go to a human.`,
    `- Approved Slack channels: ${p.allowedSlackChannels.join(", ")}.`,
    ...p.rules.map((r) => `- ${r}`),
    "Every agent also gets a finish_run tool automatically to report 'handled' or 'flagged'.",
    "Agents work one support ticket at a time; the ticket text is given to them.",
  ].join("\n");
}

const SYSTEM = [
  "You are Harbor's agent architect. A non-technical support team lead describes a job in plain English; you turn it into a precise, safe agent configuration.",
  "Principles: give the agent the fewest tools that do the job (least privilege); never invent tools; mark any tool that moves money or contacts customers as requiring approval; keep instructions concrete and checkable; include when to flag for a human.",
].join("\n");

function fromRaw(raw: RawConfig): AgentConfig {
  return {
    name: raw.name,
    description: raw.description,
    instructions: raw.instructions,
    allowedTools: raw.allowed_tools,
    riskyTools: raw.risky_tools_requiring_approval,
    model: raw.model,
    guardrails: {
      maxSteps: raw.guardrails.max_steps,
      maxCostUsd: raw.guardrails.max_cost_usd,
      maxRefundUsd: raw.guardrails.max_refund_usd,
      allowedSlackChannels: raw.guardrails.allowed_slack_channels,
      rules: raw.guardrails.extra_rules,
    },
  };
}

async function viaLlm(ws: Workspace, prompt: string): Promise<{ config: AgentConfig; reasoning: string; provider: string }> {
  const provider = getProvider();
  const res = await provider.json({ model: ws.defaultModel, system: SYSTEM, prompt, schema: CONFIG_SCHEMA, effort: "medium" });
  const raw = res.data as RawConfig;
  return { config: fromRaw(raw), reasoning: raw.reasoning, provider: res.provider };
}

/** Plain-English job -> agent config. */
export async function generateConfig(ws: Workspace, description: string): Promise<GenerateResult> {
  const t0 = Date.now();
  const prompt = `${workspaceBrief(ws)}\n\nThe team lead wrote:\n"""\n${description.trim()}\n"""\n\nDesign the agent.`;
  let base: { config: AgentConfig; reasoning: string; provider: string };
  try {
    base = getProvider().live ? await viaLlm(ws, prompt) : heuristicConfig(ws, description);
  } catch (e) {
    console.error("config generation fell back to heuristic", e);
    base = { ...heuristicConfig(ws, description), provider: "simulated (live model unavailable)" };
  }
  const { config, adjustments } = enforcePolicy(base.config, ws);
  return { config, adjustments, reasoning: base.reasoning, provider: base.provider, latencyMs: Date.now() - t0 };
}

/** Clone an existing agent into a new one, adapting it to a change request. */
export async function adaptConfig(ws: Workspace, source: AgentConfig, newName: string, change: string): Promise<GenerateResult> {
  const t0 = Date.now();
  const prompt = [
    workspaceBrief(ws),
    "",
    "Start from this existing agent, keep everything that still applies (tone, guardrails, conventions), and adapt it:",
    JSON.stringify(source, null, 2),
    "",
    `New agent name: ${newName}`,
    `What should change:\n"""\n${change.trim()}\n"""`,
  ].join("\n");
  let base: { config: AgentConfig; reasoning: string; provider: string };
  try {
    base = getProvider().live ? await viaLlm(ws, prompt) : heuristicConfig(ws, `${newName}. ${change}`, source);
  } catch (e) {
    console.error("clone adaptation fell back to heuristic", e);
    base = { ...heuristicConfig(ws, `${newName}. ${change}`, source), provider: "simulated (live model unavailable)" };
  }
  base.config.name = newName.trim() || base.config.name;
  const { config, adjustments } = enforcePolicy(base.config, ws);
  return { config, adjustments, reasoning: base.reasoning, provider: base.provider, latencyMs: Date.now() - t0 };
}

/** Offline generator: maps the description onto the closest starter template. */
export function heuristicConfig(ws: Workspace, description: string, source?: AgentConfig) {
  const d = description.toLowerCase();
  const words = d.replace(/#[a-z0-9_-]+/g, " "); // channel names like #support-urgent aren't intent
  const key = /refund|charge|money back|reimburs/.test(words)
    ? "refund"
    : /outage|down|incident/.test(words) && !/sort|triage|urgen|priorit|classif/.test(words)
      ? "outage"
      : "triage";
  const t = BUILTIN_TEMPLATES.find((b) => b.key === key)!;
  const requested = [...new Set(d.match(/#[a-z0-9_-]+/g) ?? [])];
  let instructions = t.instructions;
  const tools = new Set(t.allowedTools);
  if (requested.length) {
    instructions = instructions.replaceAll("#support-urgent", requested[0]);
    tools.add("post_slack_message");
  }
  const channels = [...new Set([...requested, ...(instructions.match(/#[a-z0-9_-]+/g) ?? [])])];
  if (/email|reply to the customer|tell the customer/.test(d)) tools.add("email_customer");
  if (/news|outage/.test(d)) tools.add("news_search");
  const guardrails = source?.guardrails ?? DEFAULT_GUARDRAILS(ws.policies);
  const name = key === "refund" ? "Refund Handler" : key === "outage" ? "Outage Watcher" : "Ticket Triage";
  return {
    config: {
      name,
      description: t.description,
      instructions,
      allowedTools: [...tools],
      riskyTools: [...t.riskyTools],
      model: source?.model ?? ws.defaultModel,
      guardrails: { ...guardrails, allowedSlackChannels: channels.length ? channels : guardrails.allowedSlackChannels },
    } satisfies AgentConfig,
    reasoning: `Matched your description to the "${t.name}" starter (offline mode). Only the tools this job needs are enabled; anything that moves money or contacts customers waits for approval.`,
    provider: "simulated",
  };
}

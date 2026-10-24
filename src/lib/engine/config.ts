import type { Guardrails, Template, Workspace } from "../db/schema";
import { MODELS } from "../llm/models";
import { TOOL_NAMES } from "../tools";

/** The editable agent config shown on the card. Stored as a template row. */
export type AgentConfig = {
  name: string;
  description: string;
  instructions: string;
  allowedTools: string[];
  riskyTools: string[];
  model: string;
  guardrails: Guardrails;
};

export function configFromTemplate(t: Template): AgentConfig {
  return {
    name: t.name,
    description: t.description,
    instructions: t.instructions,
    allowedTools: t.allowedTools,
    riskyTools: t.riskyTools,
    model: t.model,
    guardrails: t.guardrails,
  };
}

/**
 * Company policy wins over whatever the generator or the user picked. Returns the
 * corrected config plus a human-readable list of what was changed, for the UI.
 */
export function enforcePolicy(input: AgentConfig, ws: Workspace): { config: AgentConfig; adjustments: string[] } {
  const p = ws.policies;
  const adjustments: string[] = [];
  const allowedTools = [...new Set(input.allowedTools.filter((t) => TOOL_NAMES.includes(t)))];
  const risky = new Set(input.riskyTools.filter((t) => allowedTools.includes(t)));
  for (const t of p.approvalRequiredTools) {
    if (allowedTools.includes(t) && !risky.has(t)) {
      risky.add(t);
      adjustments.push(`${t} always needs manager approval (workspace policy).`);
    }
  }
  const g = { ...input.guardrails };
  if (!(g.maxSteps > 0) || g.maxSteps > p.maxStepsPerRun) {
    if (g.maxSteps > p.maxStepsPerRun) adjustments.push(`Step limit capped at the workspace maximum of ${p.maxStepsPerRun}.`);
    g.maxSteps = p.maxStepsPerRun;
  }
  if (!(g.maxCostUsd > 0) || g.maxCostUsd > p.maxCostPerRunUsd) {
    if (g.maxCostUsd > p.maxCostPerRunUsd) adjustments.push(`Cost budget capped at $${p.maxCostPerRunUsd.toFixed(2)} per run.`);
    g.maxCostUsd = p.maxCostPerRunUsd;
  }
  if (!(g.maxRefundUsd >= 0) || g.maxRefundUsd > p.maxRefundUsd) {
    if (g.maxRefundUsd > p.maxRefundUsd) adjustments.push(`Refund limit capped at the workspace maximum of $${p.maxRefundUsd}.`);
    g.maxRefundUsd = p.maxRefundUsd;
  }
  const requested = g.allowedSlackChannels ?? [];
  const channels = requested.filter((c) => p.allowedSlackChannels.includes(c));
  for (const c of requested) if (!channels.includes(c)) adjustments.push(`${c} is not an approved Slack channel, so it was removed.`);
  g.allowedSlackChannels = channels.length ? channels : allowedTools.includes("post_slack_message") ? [p.allowedSlackChannels[0]] : [];
  g.rules = (g.rules ?? []).filter((r) => r.trim().length > 0);

  const model = MODELS.some((m) => m.id === input.model) ? input.model : ws.defaultModel;
  return {
    config: {
      ...input,
      name: input.name.trim() || "Untitled agent",
      allowedTools,
      riskyTools: [...risky],
      model,
      guardrails: g,
    },
    adjustments,
  };
}

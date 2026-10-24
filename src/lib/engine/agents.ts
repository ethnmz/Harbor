import { eq } from "drizzle-orm";
import { db } from "../db";
import { agents, templates, type Workspace } from "../db/schema";
import { audit, HUMAN_ACTOR } from "../audit";
import { enforcePolicy, type AgentConfig } from "./config";

/** Saves a config as the agent's template and creates the agent (draft). */
export async function createAgent(ws: Workspace, input: AgentConfig, opts: { prompt?: string; sourceTemplateId?: string } = {}) {
  const { config, adjustments } = enforcePolicy(input, ws);
  const [template] = await db
    .insert(templates)
    .values({
      workspaceId: ws.id,
      name: config.name,
      description: config.description,
      prompt: opts.prompt ?? "",
      instructions: config.instructions,
      allowedTools: config.allowedTools,
      riskyTools: config.riskyTools,
      model: config.model,
      guardrails: config.guardrails,
      sourceTemplateId: opts.sourceTemplateId ?? null,
    })
    .returning();
  const [agent] = await db.insert(agents).values({ workspaceId: ws.id, templateId: template.id, name: config.name }).returning();
  await audit(HUMAN_ACTOR, "agent.created", agent.id, { name: config.name, tools: config.allowedTools, approvals: config.riskyTools, adjustments }, ws.id);
  return { agent, template, adjustments };
}

export async function updateAgentConfig(ws: Workspace, agentId: string, input: AgentConfig) {
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
  if (!agent) throw new Error("Agent not found");
  const { config, adjustments } = enforcePolicy(input, ws);
  await db
    .update(templates)
    .set({
      name: config.name,
      description: config.description,
      instructions: config.instructions,
      allowedTools: config.allowedTools,
      riskyTools: config.riskyTools,
      model: config.model,
      guardrails: config.guardrails,
    })
    .where(eq(templates.id, agent.templateId));
  await db.update(agents).set({ name: config.name }).where(eq(agents.id, agentId));
  await audit(HUMAN_ACTOR, "agent.updated", agentId, { tools: config.allowedTools, approvals: config.riskyTools, adjustments }, ws.id);
  return { config, adjustments };
}

export async function setAgentStatus(ws: Workspace, agentId: string, status: "live" | "paused" | "draft") {
  const [agent] = await db
    .update(agents)
    .set({ status, ...(status === "live" ? { deployedAt: new Date() } : {}) })
    .where(eq(agents.id, agentId))
    .returning();
  await audit(HUMAN_ACTOR, status === "live" ? "agent.deployed" : `agent.${status}`, agentId, { name: agent.name }, ws.id);
  return agent;
}

/** Publish the agent's config to the template gallery so the team can reuse it. */
export async function publishTemplate(ws: Workspace, agentId: string) {
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
  const [t] = await db.update(templates).set({ published: true }).where(eq(templates.id, agent.templateId)).returning();
  await audit(HUMAN_ACTOR, "template.published", t.id, { name: t.name }, ws.id);
  return t;
}

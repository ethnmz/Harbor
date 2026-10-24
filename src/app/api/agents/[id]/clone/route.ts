import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api";
import { audit, HUMAN_ACTOR } from "@/lib/audit";
import { createAgent } from "@/lib/engine/agents";
import { configFromTemplate } from "@/lib/engine/config";
import { adaptConfig } from "@/lib/engine/generate";
import { getAgent } from "@/lib/queries";
import { getWorkspace } from "@/lib/seed";

export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/** Clone an agent's config into a new draft agent, adapted to a short change request. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const { name, change } = z.object({ name: z.string().min(1).max(80), change: z.string().max(2000).default("") }).parse(await req.json());
  const source = await getAgent(id);
  if (!source) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  const ws = await getWorkspace();
  const base = configFromTemplate(source.template);
  const result = change.trim() ? await adaptConfig(ws, base, name, change) : { config: { ...base, name }, adjustments: [], reasoning: "Exact copy.", provider: "copy", latencyMs: 0 };
  const { agent } = await createAgent(ws, result.config, { prompt: change, sourceTemplateId: source.template.id });
  await audit(HUMAN_ACTOR, "agent.cloned", agent.id, { from: source.agent.name, to: name, change, provider: result.provider }, ws.id);
  return NextResponse.json({ agentId: agent.id, ...result });
});

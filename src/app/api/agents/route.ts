import { NextResponse } from "next/server";
import { z } from "zod";
import { agentConfigSchema, route } from "@/lib/api";
import { createAgent } from "@/lib/engine/agents";
import { getWorkspace } from "@/lib/seed";

export const POST = route(async (req) => {
  const body = z.object({ config: agentConfigSchema, prompt: z.string().optional() }).parse(await req.json());
  const ws = await getWorkspace();
  const { agent, adjustments } = await createAgent(ws, body.config, { prompt: body.prompt });
  return NextResponse.json({ agentId: agent.id, adjustments });
});

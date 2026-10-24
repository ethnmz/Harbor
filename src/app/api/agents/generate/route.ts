import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api";
import { audit, HUMAN_ACTOR } from "@/lib/audit";
import { generateConfig } from "@/lib/engine/generate";
import { getWorkspace } from "@/lib/seed";

export const maxDuration = 60;

export const POST = route(async (req) => {
  const { description } = z.object({ description: z.string().min(8).max(2000) }).parse(await req.json());
  const ws = await getWorkspace();
  const result = await generateConfig(ws, description);
  await audit(HUMAN_ACTOR, "agent.config_generated", null, { description, provider: result.provider, latencyMs: result.latencyMs, adjustments: result.adjustments }, ws.id);
  return NextResponse.json(result);
});

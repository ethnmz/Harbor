import { NextResponse } from "next/server";
import { z } from "zod";
import { agentConfigSchema, route } from "@/lib/api";
import { updateAgentConfig } from "@/lib/engine/agents";
import { getWorkspace } from "@/lib/seed";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const { config } = z.object({ config: agentConfigSchema }).parse(await req.json());
  const ws = await getWorkspace();
  return NextResponse.json(await updateAgentConfig(ws, id, config));
});

import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api";
import { setAgentStatus } from "@/lib/engine/agents";
import { getWorkspace } from "@/lib/seed";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const { status } = z.object({ status: z.enum(["live", "paused"]).default("live") }).parse(await req.json().catch(() => ({})));
  const agent = await setAgentStatus(await getWorkspace(), id, status);
  return NextResponse.json({ agent });
});

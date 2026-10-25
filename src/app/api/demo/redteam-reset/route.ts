import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { HUMAN_ACTOR } from "@/lib/audit";
import { resetRedTeamDemo } from "@/lib/redteam/demo";
import { getWorkspace } from "@/lib/seed";

/** Restore "Support Triage + Refunds" to its weak v1 and clear red-team and heal runs. */
export const POST = route(async () => {
  const agent = await resetRedTeamDemo(await getWorkspace(), HUMAN_ACTOR);
  return NextResponse.json({ ok: true, agentId: agent.id });
});

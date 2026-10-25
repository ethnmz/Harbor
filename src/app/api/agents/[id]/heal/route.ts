import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api";
import { HUMAN_ACTOR } from "@/lib/audit";
import { latestManualRedTeam } from "@/lib/redteam/engine";
import { getHeal, proposeHeal } from "@/lib/redteam/heal";

export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

/** Propose a patch for a red-team run's failures (defaults to the latest one). Returns the diff. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const body = z.object({ redteamRunId: z.string().uuid().optional() }).parse(await req.json().catch(() => ({})));
  const runId = body.redteamRunId ?? (await latestManualRedTeam(id))?.id;
  if (!runId) return NextResponse.json({ error: "Red-team the agent first" }, { status: 400 });
  const patch = await proposeHeal(id, runId, { actor: HUMAN_ACTOR });
  return NextResponse.json(await getHeal(patch.id));
});

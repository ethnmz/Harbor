import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { HUMAN_ACTOR } from "@/lib/audit";
import { getHeal, rejectHeal } from "@/lib/redteam/heal";

type Ctx = { params: Promise<{ id: string; patchId: string }> };

export const POST = route<Ctx>(async (_req, { params }) => {
  const { id, patchId } = await params;
  const current = await getHeal(patchId);
  if (current.patch.agentId !== id) return NextResponse.json({ error: "Patch not found" }, { status: 404 });
  await rejectHeal(patchId, HUMAN_ACTOR);
  return NextResponse.json(await getHeal(patchId));
});

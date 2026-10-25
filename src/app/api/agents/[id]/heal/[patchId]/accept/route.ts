import { after, NextResponse } from "next/server";
import { route } from "@/lib/api";
import { HUMAN_ACTOR } from "@/lib/audit";
import { acceptHeal, getHeal, verifyPatch } from "@/lib/redteam/heal";

export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string; patchId: string }> };

/** Accept: writes the new version, then re-verifies it in the background. */
export const POST = route<Ctx>(async (_req, { params }) => {
  const { id, patchId } = await params;
  const current = await getHeal(patchId);
  if (current.patch.agentId !== id) return NextResponse.json({ error: "Patch not found" }, { status: 404 });
  await acceptHeal(patchId, HUMAN_ACTOR);
  after(() => verifyPatch(patchId).catch((e) => console.error("verify failed", e)));
  return NextResponse.json(await getHeal(patchId), { status: 202 });
});

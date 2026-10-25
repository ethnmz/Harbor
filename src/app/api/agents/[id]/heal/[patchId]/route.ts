import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { getHeal } from "@/lib/redteam/heal";

type Ctx = { params: Promise<{ id: string; patchId: string }> };

/** The patch, its diff and its live verification (poll while status is "verifying"). */
export const GET = route<Ctx>(async (_req, { params }) => {
  const { id, patchId } = await params;
  const heal = await getHeal(patchId);
  if (heal.patch.agentId !== id) return NextResponse.json({ error: "Patch not found" }, { status: 404 });
  return NextResponse.json(heal);
});

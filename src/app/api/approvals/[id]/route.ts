import { after, NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api";
import { HUMAN_ACTOR } from "@/lib/audit";
import { decideApproval, resumeRun } from "@/lib/engine/run";

export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const { decision, note } = z.object({ decision: z.enum(["approved", "rejected"]), note: z.string().max(500).optional() }).parse(await req.json());
  const { approval, resumeRunId } = await decideApproval(id, decision, HUMAN_ACTOR, note);
  if (!approval) return NextResponse.json({ error: "This approval was already decided." }, { status: 409 });
  if (resumeRunId) after(() => resumeRun(resumeRunId));
  return NextResponse.json({ approval, resumed: Boolean(resumeRunId), runId: approval.runId });
});

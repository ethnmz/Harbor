import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { executeRun } from "@/lib/engine/run";

export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

/** Safety net: start a run that is still queued (idempotent: only a queued run is claimed). */
export const POST = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const run = await executeRun(id);
  return NextResponse.json({ status: run.status, outcome: run.outcome });
});

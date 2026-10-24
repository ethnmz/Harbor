import { after, NextResponse } from "next/server";
import { route } from "@/lib/api";
import { audit, HUMAN_ACTOR } from "@/lib/audit";
import { createTestBatch, executeMany } from "@/lib/engine/run";
import { getWorkspace } from "@/lib/seed";

export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

/** Queue the agent on the 10-ticket test set; runs execute after the response is sent. */
export const POST = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const ws = await getWorkspace();
  const batch = await createTestBatch(id);
  await audit(HUMAN_ACTOR, "test_run.started", id, { batchId: batch.batchId, tickets: batch.runIds.length }, ws.id);
  after(() => executeMany(batch.runIds, 4));
  return NextResponse.json(batch);
});

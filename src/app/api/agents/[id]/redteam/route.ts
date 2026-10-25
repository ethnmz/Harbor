import { after, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { route } from "@/lib/api";
import { HUMAN_ACTOR } from "@/lib/audit";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { executeRedTeam, getRedTeam, listRedTeams, startRedTeam } from "@/lib/redteam/engine";

export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

/** Start a red-team run on the agent's active version. Poll GET /api/redteam/:runId for cases. */
export const POST = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const [agent] = await db.select().from(agents).where(eq(agents.id, id));
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  const run = await startRedTeam(id, { actor: HUMAN_ACTOR });
  after(() => executeRedTeam(run.id).catch((e) => console.error("red-team failed", e)));
  return NextResponse.json({ run, cases: [] }, { status: 202 });
});

/** Recent red-team runs for the agent, newest first, with the latest one's cases. */
export const GET = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const runs = await listRedTeams(id);
  const latest = runs[0] ? await getRedTeam(runs[0].id) : null;
  return NextResponse.json({ runs, latest });
});

import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { agents, healPatches, redteamRuns } from "../db/schema";
import { ensureVersions, listVersions } from "../engine/versions";

/** Versions newest first, each with its latest finished red-team score and the patch that made it. */
export async function versionHistory(agentId: string) {
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
  if (!agent) throw new Error("Agent not found");
  const active = await ensureVersions(agentId);
  const versions = await listVersions(agentId);
  const rts = await db
    .select()
    .from(redteamRuns)
    .where(and(eq(redteamRuns.agentId, agentId), eq(redteamRuns.status, "completed")))
    .orderBy(desc(redteamRuns.createdAt));
  const patches = await db.select().from(healPatches).where(eq(healPatches.agentId, agentId));
  return {
    active: active.version,
    versions: versions.map((v) => {
      const rt = rts.find((r) => r.agentVersion === v.version);
      const patch = patches.find((p) => p.id === v.createdFromPatch);
      return {
        version: v.version,
        createdAt: v.createdAt,
        active: v.version === active.version,
        redteam: rt ? { runId: rt.id, score: rt.score, total: rt.total } : null,
        patch: patch ? { id: patch.id, status: patch.status, iteration: patch.iteration, source: patch.source } : null,
      };
    }),
  };
}

/** Everything the agent page's red-team panel needs on first render. */
export async function redTeamPanelState(agentId: string) {
  const history = await versionHistory(agentId);
  const [latestRun] = await db
    .select()
    .from(redteamRuns)
    .where(and(eq(redteamRuns.agentId, agentId), eq(redteamRuns.purpose, "manual")))
    .orderBy(desc(redteamRuns.createdAt))
    .limit(1);
  const [patch] = latestRun
    ? await db
        .select({ id: healPatches.id })
        .from(healPatches)
        .where(and(eq(healPatches.redteamRunId, latestRun.id), eq(healPatches.iteration, 1)))
        .orderBy(desc(healPatches.createdAt))
        .limit(1)
    : [];
  return { ...history, latestRunId: latestRun?.id ?? null, patchId: patch?.id ?? null };
}

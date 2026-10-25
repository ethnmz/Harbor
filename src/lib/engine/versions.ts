/**
 * Agent versions. Each version is an immutable snapshot: its own templates row plus an
 * agent_versions row. The agent's active version is the one whose template it points at,
 * so the existing runner (which reads agent.templateId) needs no changes to use it.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { agentVersions, agents, templates, type Workspace } from "../db/schema";
import { audit } from "../audit";
import { configFromTemplate, type AgentConfig } from "./config";

export type AgentVersion = typeof agentVersions.$inferSelect;

/** Snapshot the current config as v1 the first time versioning touches an agent. */
export async function ensureVersions(agentId: string): Promise<AgentVersion> {
  const find = async (q: Pick<typeof db, "select">, templateId: string) =>
    (await q.select().from(agentVersions).where(and(eq(agentVersions.agentId, agentId), eq(agentVersions.templateId, templateId))))[0];
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
  if (!agent) throw new Error("Agent not found");
  const active = await find(db, agent.templateId);
  if (active) return active;
  // Page renders can race here; a per-agent lock makes the snapshot happen exactly once.
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${agentId}))`);
    const existing = await find(tx, agent.templateId);
    if (existing) return existing;
    const [template] = await tx.select().from(templates).where(eq(templates.id, agent.templateId));
    const [latest] = await tx.select().from(agentVersions).where(eq(agentVersions.agentId, agentId)).orderBy(desc(agentVersions.version)).limit(1);
    const [row] = await tx
      .insert(agentVersions)
      .values({ agentId, version: (latest?.version ?? 0) + 1, templateId: template.id, config: configFromTemplate(template) })
      .returning();
    return row;
  });
}

/** The active version number, or null if the agent has never been versioned. */
export async function activeVersionNumber(agentId: string, templateId: string) {
  const [row] = await db
    .select({ version: agentVersions.version })
    .from(agentVersions)
    .where(and(eq(agentVersions.agentId, agentId), eq(agentVersions.templateId, templateId)));
  return row?.version ?? null;
}

export async function getVersion(agentId: string, version: number) {
  const [row] = await db
    .select()
    .from(agentVersions)
    .where(and(eq(agentVersions.agentId, agentId), eq(agentVersions.version, version)));
  return row ?? null;
}

export async function listVersions(agentId: string) {
  return db.select().from(agentVersions).where(eq(agentVersions.agentId, agentId)).orderBy(desc(agentVersions.version));
}

/** Write a new immutable version from a config and make it active. Old versions are never touched. */
export async function createVersion(ws: Workspace, agentId: string, config: AgentConfig, opts: { patchId?: string; actor: string }) {
  await ensureVersions(agentId);
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
  const [prev] = await db.select().from(templates).where(eq(templates.id, agent.templateId));
  const [template] = await db
    .insert(templates)
    .values({
      workspaceId: ws.id,
      name: config.name,
      description: config.description,
      prompt: prev?.prompt ?? "",
      instructions: config.instructions,
      allowedTools: config.allowedTools,
      riskyTools: config.riskyTools,
      model: config.model,
      guardrails: config.guardrails,
      sourceTemplateId: prev?.id ?? null,
    })
    .returning();
  const [latest] = await db.select().from(agentVersions).where(eq(agentVersions.agentId, agentId)).orderBy(desc(agentVersions.version)).limit(1);
  const [version] = await db
    .insert(agentVersions)
    .values({ agentId, version: (latest?.version ?? 0) + 1, templateId: template.id, config, createdFromPatch: opts.patchId ?? null })
    .returning();
  await db.update(agents).set({ templateId: template.id, name: config.name }).where(eq(agents.id, agentId));
  await audit(opts.actor, "agent.version_created", agentId, { version: version.version, patch: opts.patchId ?? null }, ws.id);
  return version;
}

/** Point the agent back at an earlier version (rollback). */
export async function activateVersion(ws: Workspace, agentId: string, version: number, actor: string) {
  const row = await getVersion(agentId, version);
  if (!row) throw new Error(`Version ${version} not found`);
  await db.update(agents).set({ templateId: row.templateId }).where(eq(agents.id, agentId));
  await audit(actor, "agent.version_activated", agentId, { version }, ws.id);
  return row;
}

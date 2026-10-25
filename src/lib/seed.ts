import { cache } from "react";
import { eq, sql as dsql } from "drizzle-orm";
import { db, sql } from "./db";
import {
  agentVersions,
  agents,
  healPatches,
  redteamRuns,
  approvals,
  auditLog,
  outboundEmails,
  refunds,
  runSteps,
  runs,
  slackMessages,
  templates,
  tickets,
  tools,
  workspaces,
  type Workspace,
} from "./db/schema";
import {
  BUILTIN_TEMPLATES,
  DEFAULT_GUARDRAILS,
  DEFAULT_POLICIES,
  DEMO_WORKSPACE,
  SEED_TICKETS,
  TOOL_CONNECTIONS,
} from "./seed-data";
import { DEFAULT_MODEL } from "./llm/models";
import { ensureDemoAgent } from "./redteam/demo";

/** Cached per request, so the layouts and the page share one query. */
export const getWorkspace = cache(async (): Promise<Workspace> => {
  const [existing] = await db.select().from(workspaces).limit(1);
  if (existing) return existing;
  return seedWorkspace();
});

async function seedWorkspace(): Promise<Workspace> {
  const [ws] = await db
    .insert(workspaces)
    .values({ ...DEMO_WORKSPACE, defaultModel: DEFAULT_MODEL, policies: DEFAULT_POLICIES })
    .returning();
  await db.insert(tools).values(TOOL_CONNECTIONS.map((t) => ({ workspaceId: ws.id, key: t.key, name: t.name, config: { ...t.config } })));
  await seedBuiltinTemplates(ws);
  await seedTickets();
  await ensureDemoAgent(ws);
  return ws;
}

async function seedBuiltinTemplates(ws: Workspace) {
  await db.insert(templates).values(
    BUILTIN_TEMPLATES.map((t) => ({
      workspaceId: ws.id,
      name: t.name,
      description: t.description,
      prompt: t.prompt,
      instructions: t.instructions,
      allowedTools: t.allowedTools,
      riskyTools: t.riskyTools,
      model: ws.defaultModel,
      guardrails: DEFAULT_GUARDRAILS(ws.policies),
      published: true,
      builtin: true,
    })),
  );
}

export async function seedTickets() {
  const now = Date.now();
  await db.delete(tickets);
  await db.insert(tickets).values(
    SEED_TICKETS.map(({ minutesAgo, ...t }) => ({
      ...t,
      receivedAt: new Date(now - minutesAgo * 60_000),
      updatedAt: new Date(now - minutesAgo * 60_000),
    })),
  );
}

/** Back to a clean demo: keeps workspace setup, wipes agents, runs, approvals and logs, re-seeds the inbox. */
export async function resetDemo() {
  const ws = await getWorkspace();
  await db.transaction(async (tx) => {
    await tx.delete(healPatches);
    await tx.delete(redteamRuns);
    await tx.delete(slackMessages);
    await tx.delete(refunds);
    await tx.delete(outboundEmails);
    await tx.delete(approvals);
    await tx.delete(runSteps);
    await tx.delete(runs);
    await tx.delete(agentVersions);
    await tx.delete(agents);
    await tx.delete(templates).where(eq(templates.workspaceId, ws.id));
    await tx.delete(auditLog);
  });
  await seedBuiltinTemplates(ws);
  await seedTickets();
  await ensureDemoAgent(ws);
  return ws;
}

/** Tiger Cloud extras. Each step is optional so plain Postgres keeps working. */
export async function setupTimescale(log: (m: string) => void = console.log) {
  const [{ available }] = await sql<{ available: boolean }[]>`
    select exists(select 1 from pg_available_extensions where name = 'timescaledb') as available`;
  if (!available) {
    log("timescaledb not available: skipping hypertable setup (plain Postgres mode)");
    return false;
  }
  const steps: [string, () => Promise<unknown>][] = [
    ["extension", () => sql`create extension if not exists timescaledb`],
    [
      "audit_log hypertable",
      () => sql`select create_hypertable('audit_log', by_range('created_at'), if_not_exists => true, migrate_data => true)`,
    ],
    ["audit_log retention (400 days)", () => sql`select add_retention_policy('audit_log', interval '400 days', if_not_exists => true)`],
    [
      "audit_log compression",
      async () => {
        await sql`alter table audit_log set (timescaledb.compress, timescaledb.compress_segmentby = 'workspace_id')`;
        await sql`select add_compression_policy('audit_log', interval '30 days', if_not_exists => true)`;
      },
    ],
  ];
  for (const [name, run] of steps) {
    try {
      await run();
      log(`timescale: ${name} ok`);
    } catch (e) {
      log(`timescale: ${name} skipped (${(e as Error).message})`);
    }
  }
  return true;
}

export async function countRows() {
  const [r] = await db.execute<{ tickets: number }>(dsql`select count(*)::int as tickets from tickets`);
  return r;
}

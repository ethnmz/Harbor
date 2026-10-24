/** Read models for pages and polling endpoints. */
import { and, asc, count, desc, eq, inArray, sql as dsql } from "drizzle-orm";
import { db, sql } from "./db";
import { agents, approvals, auditLog, runSteps, runs, slackMessages, templates, tickets } from "./db/schema";
import { getProvider } from "./llm";
import { connectionStatus, TOOLS } from "./tools";

export function integrationStatus() {
  const llm = getProvider();
  return {
    llm: { live: llm.live, label: llm.live ? "Anthropic" : "Simulator" },
    serpapi: connectionStatus("serpapi"),
    slack: connectionStatus("slack"),
    db: { live: true, label: process.env.DATABASE_URL?.includes("tsdb.cloud.timescale.com") || process.env.DATABASE_URL?.includes("tigerdata") ? "Tiger Cloud" : "Postgres" },
  };
}

let timescaleCache: boolean | null = null;
export async function hasTimescale() {
  if (timescaleCache !== null) return timescaleCache;
  const [r] = await sql<{ on: boolean }[]>`select exists(select 1 from pg_extension where extname = 'timescaledb') as on`;
  timescaleCache = r.on;
  return r.on;
}

export async function pendingApprovalCount() {
  const [r] = await db.select({ n: count() }).from(approvals).where(eq(approvals.status, "pending"));
  return r.n;
}

export type AgentRow = Awaited<ReturnType<typeof listAgents>>[number];

export async function listAgents() {
  const rows = await db
    .select({ agent: agents, template: templates })
    .from(agents)
    .innerJoin(templates, eq(agents.templateId, templates.id))
    .orderBy(desc(agents.createdAt));
  const stats = await agentStats();
  return rows.map((r) => ({ ...r, stats: stats.get(r.agent.id) ?? emptyStats() }));
}

function emptyStats() {
  return { runs: 0, handled: 0, flagged: 0, failed: 0, waiting: 0, cost: 0, avgMs: 0, lastRunAt: null as Date | null };
}

export async function agentStats() {
  const rows = await db
    .select({
      agentId: runs.agentId,
      runs: count(),
      handled: dsql<number>`count(*) filter (where ${runs.outcome} = 'handled')::int`,
      flagged: dsql<number>`count(*) filter (where ${runs.outcome} = 'flagged')::int`,
      failed: dsql<number>`count(*) filter (where ${runs.status} = 'failed')::int`,
      waiting: dsql<number>`count(*) filter (where ${runs.status} = 'awaiting_approval')::int`,
      cost: dsql<number>`coalesce(sum(${runs.costEstimate}), 0)::float`,
      avgMs: dsql<number>`coalesce(avg(extract(epoch from (${runs.endedAt} - ${runs.startedAt})) * 1000) filter (where ${runs.endedAt} is not null), 0)::int`,
      lastRunAt: dsql<Date | null>`max(${runs.createdAt})`,
    })
    .from(runs)
    .groupBy(runs.agentId);
  return new Map(rows.map((r) => [r.agentId, { ...r, lastRunAt: r.lastRunAt ? new Date(r.lastRunAt) : null }]));
}

export async function getAgent(id: string) {
  const [row] = await db.select({ agent: agents, template: templates }).from(agents).innerJoin(templates, eq(agents.templateId, templates.id)).where(eq(agents.id, id));
  return row ?? null;
}

export async function recentRuns(opts: { agentId?: string; limit?: number } = {}) {
  return db
    .select({ run: runs, ticket: { id: tickets.id, subject: tickets.subject, customerName: tickets.customerName }, agentName: agents.name })
    .from(runs)
    .innerJoin(agents, eq(runs.agentId, agents.id))
    .leftJoin(tickets, eq(runs.ticketId, tickets.id))
    .where(opts.agentId ? eq(runs.agentId, opts.agentId) : undefined)
    .orderBy(desc(runs.createdAt))
    .limit(opts.limit ?? 25);
}

export async function getRunDetail(runId: string) {
  const [row] = await db
    .select({ run: runs, agent: agents, ticket: tickets })
    .from(runs)
    .innerJoin(agents, eq(runs.agentId, agents.id))
    .leftJoin(tickets, eq(runs.ticketId, tickets.id))
    .where(eq(runs.id, runId));
  if (!row) return null;
  const steps = await db.select().from(runSteps).where(eq(runSteps.runId, runId)).orderBy(asc(runSteps.seq));
  const aps = await db.select().from(approvals).where(eq(approvals.runId, runId)).orderBy(asc(approvals.createdAt));
  const { state: _state, ...run } = row.run;
  void _state;
  return { run, agent: row.agent, ticket: row.ticket, steps, approvals: aps };
}

export type RunDetail = NonNullable<Awaited<ReturnType<typeof getRunDetail>>>;

export async function getBatch(batchId: string) {
  const rows = await db
    .select({
      id: runs.id,
      status: runs.status,
      outcome: runs.outcome,
      summary: runs.summary,
      cost: runs.costEstimate,
      toolCalls: runs.toolCalls,
      startedAt: runs.startedAt,
      endedAt: runs.endedAt,
      ticketId: tickets.id,
      subject: tickets.subject,
      customer: tickets.customerName,
      urgency: tickets.urgency,
      category: tickets.category,
    })
    .from(runs)
    .leftJoin(tickets, eq(runs.ticketId, tickets.id))
    .where(eq(runs.batchId, batchId))
    .orderBy(asc(runs.createdAt));
  const ids = rows.map((r) => r.id);
  const lastSteps = ids.length
    ? await db
        .selectDistinctOn([runSteps.runId], { runId: runSteps.runId, type: runSteps.type, toolName: runSteps.toolName })
        .from(runSteps)
        .where(inArray(runSteps.runId, ids))
        .orderBy(runSteps.runId, desc(runSteps.seq))
    : [];
  const searches = ids.length
    ? await db
        .select({ runId: runSteps.runId, n: count() })
        .from(runSteps)
        .where(and(inArray(runSteps.runId, ids), inArray(runSteps.toolName, ["news_search", "web_search"]), eq(runSteps.type, "tool")))
        .groupBy(runSteps.runId)
    : [];
  return rows.map((r) => ({
    ...r,
    current: lastSteps.find((s) => s.runId === r.id) ?? null,
    searches: searches.find((s) => s.runId === r.id)?.n ?? 0,
  }));
}

export type BatchRow = Awaited<ReturnType<typeof getBatch>>[number];

export async function listApprovals() {
  return db
    .select({ approval: approvals, agentName: agents.name, ticket: { id: tickets.id, subject: tickets.subject, customerName: tickets.customerName, customerEmail: tickets.customerEmail } })
    .from(approvals)
    .innerJoin(agents, eq(approvals.agentId, agents.id))
    .leftJoin(tickets, eq(approvals.ticketId, tickets.id))
    .orderBy(desc(approvals.createdAt))
    .limit(100);
}

export async function listTickets() {
  return db
    .select({ ticket: tickets, agentName: agents.name })
    .from(tickets)
    .leftJoin(agents, eq(tickets.handledByAgentId, agents.id))
    .orderBy(
      dsql`case ${tickets.urgency} when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 when 'low' then 3 else 4 end`,
      desc(tickets.receivedAt),
    );
}

export async function recentAudit(limit = 30) {
  return db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit);
}

export async function recentSlack(limit = 8) {
  return db.select().from(slackMessages).orderBy(desc(slackMessages.createdAt)).limit(limit);
}

export async function listTemplates() {
  return db.select().from(templates).where(eq(templates.published, true)).orderBy(desc(templates.builtin), asc(templates.createdAt));
}

/** Runs per 15-minute bucket over the last 6 hours. Uses TimescaleDB's time_bucket on Tiger Cloud. */
export async function runTimeline() {
  const ts = await hasTimescale();
  const bucket = ts ? dsql`time_bucket('15 minutes', ${runs.createdAt})` : dsql`date_bin('15 minutes', ${runs.createdAt}, timestamptz '2000-01-01')`;
  const rows = await db
    .select({
      bucket: dsql<string>`${bucket}`.as("bucket"),
      total: count(),
      handled: dsql<number>`count(*) filter (where ${runs.outcome} = 'handled')::int`,
      flagged: dsql<number>`count(*) filter (where ${runs.outcome} = 'flagged' or ${runs.status} = 'awaiting_approval')::int`,
      failed: dsql<number>`count(*) filter (where ${runs.status} = 'failed')::int`,
    })
    .from(runs)
    .where(dsql`${runs.createdAt} > now() - interval '6 hours'`)
    .groupBy(dsql`1`)
    .orderBy(dsql`1`);
  return { engine: ts ? "time_bucket (TimescaleDB)" : "date_bin (Postgres)", rows };
}

export async function totals() {
  const [r] = await db
    .select({
      runs: count(),
      handled: dsql<number>`count(*) filter (where ${runs.outcome} = 'handled')::int`,
      flagged: dsql<number>`count(*) filter (where ${runs.outcome} = 'flagged')::int`,
      failed: dsql<number>`count(*) filter (where ${runs.status} = 'failed')::int`,
      cost: dsql<number>`coalesce(sum(${runs.costEstimate}), 0)::float`,
      tokens: dsql<number>`coalesce(sum(${runs.inputTokens} + ${runs.outputTokens}), 0)::int`,
      toolCalls: dsql<number>`coalesce(sum(${runs.toolCalls}), 0)::int`,
      avgMs: dsql<number>`coalesce(avg(extract(epoch from (${runs.endedAt} - ${runs.startedAt})) * 1000) filter (where ${runs.endedAt} is not null), 0)::int`,
    })
    .from(runs);
  const [s] = await db.select({ n: count() }).from(runSteps).where(inArray(runSteps.toolName, ["news_search", "web_search"]));
  return { ...r, searches: s.n };
}

export const TOOL_CATALOG = TOOLS.map(({ name, label, description, connection, risky }) => ({ name, label, description, connection, risky }));
export type ToolCatalogEntry = (typeof TOOL_CATALOG)[number];

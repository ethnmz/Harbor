/** Read models for pages and polling endpoints. */
import { and, asc, count, desc, eq, inArray, isNotNull, notLike, sql as dsql } from "drizzle-orm";
import { db, sql } from "./db";
import { agents, approvals, auditLog, outboundEmails, refunds, runSteps, runs, slackMessages, templates, tickets } from "./db/schema";
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

/** Every ticket with its latest agent run, for the inbox list. */
export async function inboxTickets() {
  const [rows, latest] = await Promise.all([
    listTickets(),
    db
      .selectDistinctOn([runs.ticketId], { ticketId: runs.ticketId, id: runs.id, status: runs.status, outcome: runs.outcome, summary: runs.summary, agentName: agents.name })
      .from(runs)
      .innerJoin(agents, eq(runs.agentId, agents.id))
      .where(isNotNull(runs.ticketId))
      .orderBy(runs.ticketId, desc(runs.createdAt)),
  ]);
  const byTicket = new Map(latest.map((r) => [r.ticketId, r]));
  return rows.map((r) => ({ ...r, run: byTicket.get(r.ticket.id) ?? null }));
}
export type InboxRow = Awaited<ReturnType<typeof inboxTickets>>[number];

/** One ticket as a conversation: the customer's message plus everything agents and people did about it. */
export async function ticketThread(id: string) {
  const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id));
  if (!ticket) return null;
  const runRows = await db
    .select({ run: runs, agentName: agents.name })
    .from(runs)
    .innerJoin(agents, eq(runs.agentId, agents.id))
    .where(eq(runs.ticketId, id))
    .orderBy(asc(runs.createdAt));
  const runIds = runRows.map((r) => r.run.id);
  const [steps, pending, emails, refundRows] = await Promise.all([
    runIds.length
      ? db
          .select()
          .from(runSteps)
          .where(and(inArray(runSteps.runId, runIds), eq(runSteps.type, "tool"), eq(runSteps.status, "ok"), inArray(runSteps.toolName, ["update_ticket", "news_search", "web_search", "post_slack_message"])))
      : [],
    runIds.length ? db.select().from(approvals).where(and(inArray(approvals.runId, runIds), eq(approvals.status, "pending"))) : [],
    db.select().from(outboundEmails).where(eq(outboundEmails.ticketId, id)),
    db.select().from(refunds).where(eq(refunds.ticketId, id)),
  ]);
  return { ticket, runs: runRows, steps, pending, emails, refunds: refundRows };
}
export type TicketThread = NonNullable<Awaited<ReturnType<typeof ticketThread>>>;

export async function recentAudit(limit = 30) {
  return db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit);
}

export async function listTemplates() {
  return db.select().from(templates).where(eq(templates.published, true)).orderBy(desc(templates.builtin), asc(templates.createdAt));
}

export async function totals() {
  const [r] = await db
    .select({
      runs: count(),
      handled: dsql<number>`count(*) filter (where ${runs.outcome} = 'handled')::int`,
      flagged: dsql<number>`count(*) filter (where ${runs.outcome} = 'flagged')::int`,
      failed: dsql<number>`count(*) filter (where ${runs.status} = 'failed')::int`,
      waiting: dsql<number>`count(*) filter (where ${runs.status} = 'awaiting_approval')::int`,
      cost: dsql<number>`coalesce(sum(${runs.costEstimate}), 0)::float`,
      tokens: dsql<number>`coalesce(sum(${runs.inputTokens} + ${runs.outputTokens}), 0)::int`,
      toolCalls: dsql<number>`coalesce(sum(${runs.toolCalls}), 0)::int`,
      avgMs: dsql<number>`coalesce(avg(extract(epoch from (${runs.endedAt} - ${runs.startedAt})) * 1000) filter (where ${runs.endedAt} is not null), 0)::int`,
    })
    .from(runs);
  const [s] = await db.select({ n: count() }).from(runSteps).where(inArray(runSteps.toolName, ["news_search", "web_search"]));
  return { ...r, searches: s.n };
}

/**
 * Handled vs. routed-to-a-human runs over an adaptive window (last hour, 6 hours or
 * 24 hours depending on how far back activity goes), bucketed with TimescaleDB's
 * time_bucket on Tiger Cloud and date_bin elsewhere.
 */
export async function runSeries() {
  const ts = await hasTimescale();
  const [{ first }] = await db
    .select({ first: dsql<string | null>`min(${runs.createdAt})` })
    .from(runs)
    .where(dsql`${runs.createdAt} > now() - interval '24 hours'`);
  const spanH = first ? (Date.now() - new Date(first).getTime()) / 3_600_000 : 0;
  const preset =
    spanH <= 1 ? { label: "Last hour", hours: 1, minutes: 5 } : spanH <= 6 ? { label: "Last 6 hours", hours: 6, minutes: 30 } : { label: "Last 24 hours", hours: 24, minutes: 120 };
  const stride = `${preset.minutes} minutes`;
  const bucket = ts ? dsql`time_bucket(${stride}::interval, ${runs.createdAt})` : dsql`date_bin(${stride}::interval, ${runs.createdAt}, timestamptz '2000-01-01')`;
  const rows = await db
    .select({
      bucket: dsql<string>`${bucket}`.as("bucket"),
      handled: dsql<number>`count(*) filter (where ${runs.outcome} = 'handled')::int`,
      human: dsql<number>`count(*) filter (where ${runs.outcome} in ('flagged', 'failed') or ${runs.status} in ('awaiting_approval', 'failed'))::int`,
    })
    .from(runs)
    .where(dsql`${runs.createdAt} > now() - make_interval(hours => ${preset.hours})`)
    .groupBy(dsql`1`)
    .orderBy(dsql`1`);
  return { ...preset, engine: ts ? "time_bucket (TimescaleDB)" : "date_bin (Postgres)", rows };
}

export type FeedItem =
  | {
      kind: "approval";
      at: Date;
      agentName: string;
      ticketId: string | null;
      runId: string;
      actions: { approvalId: string; action: string; args: Record<string, unknown> }[];
    }
  | { kind: "slack"; at: Date; agentName: string | null; channel: string; text: string; delivered: boolean; runId: string | null }
  | { kind: "event"; at: Date; actor: string; agentName: string | null; text: string; target: string | null; href: string | null };

/** What agents and people did recently: pending approvals, Slack posts and key decisions. */
export async function activityFeed(limit = 7): Promise<FeedItem[]> {
  const [pending, posts, events] = await Promise.all([
    db
      .select({ approval: approvals, agentName: agents.name })
      .from(approvals)
      .innerJoin(agents, eq(approvals.agentId, agents.id))
      .where(eq(approvals.status, "pending"))
      .orderBy(desc(approvals.createdAt))
      .limit(8),
    db
      .select({ m: slackMessages, agentName: agents.name })
      .from(slackMessages)
      .leftJoin(runs, eq(slackMessages.runId, runs.id))
      .leftJoin(agents, eq(runs.agentId, agents.id))
      .where(notLike(slackMessages.text, ":raised_hand:%"))
      .orderBy(desc(slackMessages.createdAt))
      .limit(5),
    db
      .select()
      .from(auditLog)
      .where(inArray(auditLog.action, ["agent.deployed", "agent.cloned", "approval.approved", "approval.rejected"]))
      .orderBy(desc(auditLog.createdAt))
      .limit(5),
  ]);
  // One card per paused run, with its actions in the order the agent asked for them.
  const byRun = new Map<string, Extract<FeedItem, { kind: "approval" }>>();
  for (const { approval: a, agentName } of pending) {
    const group = byRun.get(a.runId) ?? { kind: "approval" as const, at: a.createdAt, agentName, ticketId: a.ticketId, runId: a.runId, actions: [] };
    group.actions.unshift({ approvalId: a.id, action: a.action, args: a.args });
    byRun.set(a.runId, group);
  }
  const items: FeedItem[] = [
    ...byRun.values(),
    ...posts.map(({ m, agentName }) => ({
      kind: "slack" as const,
      at: m.createdAt,
      agentName,
      channel: m.channel,
      text: m.text,
      delivered: m.delivered,
      runId: m.runId,
    })),
    ...events.map((e) => {
      const d = e.details as Record<string, unknown>;
      const text =
        e.action === "agent.deployed"
          ? `Deployed ${String(d.name)}`
          : e.action === "agent.cloned"
            ? `Cloned ${String(d.from)} into ${String(d.to)}`
            : `${e.action === "approval.approved" ? "Approved" : "Rejected"} ${d.tool === "issue_refund" ? "a refund" : d.tool === "email_customer" ? "a customer email" : String(d.tool)}`;
      const href = e.action.startsWith("approval.") ? `/runs/${String(d.run)}` : e.target ? `/agents/${e.target}` : null;
      const agentName = e.action === "agent.deployed" ? String(d.name) : e.action === "agent.cloned" ? String(d.to) : null;
      return { kind: "event" as const, at: e.createdAt, actor: e.actor, agentName, text, target: e.target, href };
    }),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}

export const TOOL_CATALOG = TOOLS.map(({ name, label, description, connection, risky }) => ({ name, label, description, connection, risky }));
export type ToolCatalogEntry = (typeof TOOL_CATALOG)[number];

import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { AgentActions } from "@/components/agent-actions";
import { ConfigCard } from "@/components/agent-builder/config-card";
import { RunsTable } from "@/components/runs-table";
import { AgentStatusBadge } from "@/components/status";
import { PageHeader, Stat } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { tickets } from "@/lib/db/schema";
import { configFromTemplate } from "@/lib/engine/config";
import { modelInfo } from "@/lib/llm/models";
import { builderProps } from "@/lib/page-data";
import { agentStats, getAgent, recentRuns } from "@/lib/queries";
import { getWorkspace } from "@/lib/seed";
import { formatMs, formatUsd, pct, timeAgo } from "@/lib/utils";

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getAgent(id);
  if (!row) notFound();
  const ws = await getWorkspace();
  const [runs, stats, allTickets, props] = await Promise.all([recentRuns({ agentId: id, limit: 30 }), agentStats(), db.select().from(tickets).orderBy(asc(tickets.id)), builderProps(ws)]);
  const s = stats.get(id) ?? { runs: 0, handled: 0, flagged: 0, failed: 0, waiting: 0, cost: 0, avgMs: 0, lastRunAt: null };
  const openInbox = allTickets.filter((t) => t.status === "open" && !t.inTestSet).length;
  const { agent, template } = row;

  return (
    <>
      <PageHeader
        eyebrow="Agents"
        title={
          <span className="flex items-center gap-3">
            {agent.name} <AgentStatusBadge status={agent.status} />
          </span>
        }
        description={
          <>
            {template.description} <span className="text-muted-foreground/80">· {modelInfo(template.model).label}</span>
            {agent.deployedAt && <span className="text-muted-foreground/80"> · deployed {timeAgo(agent.deployedAt)}</span>}
          </>
        }
      />
      <AgentActions
        agentId={agent.id}
        agentName={agent.name}
        status={agent.status}
        published={template.published}
        tickets={allTickets.map((t) => ({ id: t.id, subject: t.subject }))}
        openInbox={openInbox}
      />

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Runs" value={s.runs} />
        <Stat label="Handled" value={`${pct(s.handled, s.runs)}%`} tone="success" hint={`${s.handled} of ${s.runs}`} />
        <Stat label="Flagged / waiting" value={s.flagged + s.waiting} tone={s.flagged + s.waiting ? "warning" : undefined} />
        <Stat label="Est. cost" value={formatUsd(s.cost, 2)} hint={s.runs ? `${formatUsd(s.cost / s.runs)} per run` : undefined} />
        <Stat label="Avg run time" value={s.avgMs ? formatMs(s.avgMs) : "—"} />
      </div>

      <h2 className="mt-8 mb-3 text-[15px] font-semibold tracking-tight">Recent runs</h2>
      <RunsTable rows={runs} showAgent={false} empty="Run it on a ticket above, or re-test it on the 10 sample tickets." />

      <h2 className="mt-8 mb-3 text-[15px] font-semibold tracking-tight">Configuration</h2>
      <ConfigCard config={configFromTemplate(template)} catalog={props.catalog} models={props.models} workspace={props.workspace} readOnly />
    </>
  );
}

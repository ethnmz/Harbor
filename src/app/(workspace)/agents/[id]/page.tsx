import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { asc, eq } from "drizzle-orm";
import { AgentActions } from "@/components/agent-actions";
import { ConfigCard } from "@/components/agent-builder/config-card";
import { RunsTable } from "@/components/runs-table";
import { AgentStatusBadge } from "@/components/status";
import { Panel, Stat } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { tickets } from "@/lib/db/schema";
import { configFromTemplate } from "@/lib/engine/config";
import { modelInfo } from "@/lib/llm/models";
import { builderProps } from "@/lib/page-data";
import { agentStats, getAgent, recentRuns, TOOL_CATALOG } from "@/lib/queries";
import { getWorkspace } from "@/lib/seed";
import { formatMs, formatUsd, pct, timeAgo } from "@/lib/utils";
import { AgentOrb } from "@/components/agent-orb";
import { RedTeamPanel } from "@/components/redteam/panel";
import { DEMO_AGENT_NAME } from "@/lib/redteam/demo";
import { redTeamPanelState } from "@/lib/redteam/history";

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getAgent(id);
  if (!row) notFound();
  const ws = await getWorkspace();
  const [runs, stats, allTickets, props, redteam] = await Promise.all([recentRuns({ agentId: id, limit: 30 }), agentStats(), db.select().from(tickets).where(eq(tickets.sandbox, false)).orderBy(asc(tickets.id)), builderProps(ws), redTeamPanelState(id)]);
  const s = stats.get(id) ?? { runs: 0, handled: 0, flagged: 0, failed: 0, waiting: 0, cost: 0, avgMs: 0, lastRunAt: null };
  const openInbox = allTickets.filter((t) => t.status === "open" && !t.inTestSet).length;
  const { agent, template } = row;
  const cfg = configFromTemplate(template);
  const label = (t: string) => TOOL_CATALOG.find((c) => c.name === t)?.label ?? t;

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <Panel
        eyebrow={
          <Link href="/agents" className="hover:text-foreground">
            Agent library
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3.5">
            <AgentOrb seed={agent.name} size={36} shape="tile" live={agent.status === "live"} />
            {agent.name}
            <span className="rounded-full bg-foreground px-2.5 py-0.5 text-[13px] font-semibold text-background" title="Active version">
              v{redteam.active}
            </span>
            <AgentStatusBadge status={agent.status} />
          </span>
        }
        description={
          <>
            {template.description} <span className="text-muted-foreground/80">· {modelInfo(template.model).label}</span>
            {agent.deployedAt && <span className="text-muted-foreground/80"> · deployed {timeAgo(agent.deployedAt)}</span>}
          </>
        }
      >
        <AgentActions
          agentId={agent.id}
          agentName={agent.name}
          status={agent.status}
          published={template.published}
          tickets={allTickets.map((t) => ({ id: t.id, subject: t.subject }))}
          openInbox={openInbox}
        />
        <div className="mt-6 grid grid-cols-3 gap-4">
          <Stat label="Runs" value={s.runs} hint={s.runs ? `${formatUsd(s.cost, 2)} · avg ${s.avgMs ? formatMs(s.avgMs) : "—"}` : undefined} />
          <Stat label="Handled" value={`${pct(s.handled, s.runs)}%`} tone="success" hint={`${s.handled} of ${s.runs}`} />
          <Stat label="Went to a person" value={s.flagged + s.waiting} tone={s.flagged + s.waiting ? "warning" : undefined} hint={s.failed ? `${s.failed} failed` : undefined} />
        </div>
      </Panel>

      <RedTeamPanel
        key={agent.id}
        agentId={agent.id}
        initialRunId={redteam.latestRunId}
        initialPatchId={redteam.patchId}
        versions={redteam.versions.map((v) => ({ version: v.version, active: v.active, redteam: v.redteam }))}
        isDemo={agent.name === DEMO_AGENT_NAME}
      />

      <Panel title="Recent runs">
        <RunsTable rows={runs} showAgent={false} empty="Use “Try on a ticket” above, or Edit to re-test it on the 10 sample tickets." />
      </Panel>

      <Panel
        title="How it works"
        description="What this agent may do. Harbor enforces the limits in code on every run."
        actions={
          <Button variant="outline" asChild>
            <Link href={`/agents/new?draft=${agent.id}`}>Edit</Link>
          </Button>
        }
      >
        <dl className="grid gap-x-8 gap-y-5 text-[15px] sm:grid-cols-[180px_1fr]">
          <dt className="text-muted-foreground">Uses</dt>
          <dd className="flex flex-wrap gap-2">
            {cfg.allowedTools.map((t) => (
              <span key={t} className="rounded-full bg-muted px-3 py-1 text-[14px] font-medium">
                {label(t)}
              </span>
            ))}
          </dd>
          <dt className="text-muted-foreground">Asks a manager first</dt>
          <dd className="font-medium">{cfg.riskyTools.map(label).join(", ") || "Nothing"}</dd>
          <dt className="text-muted-foreground">Limits</dt>
          <dd className="font-medium">
            {cfg.guardrails.maxSteps} steps · {formatUsd(cfg.guardrails.maxCostUsd, 2)} per run
            {cfg.allowedTools.includes("issue_refund") && ` · refunds up to $${cfg.guardrails.maxRefundUsd}`}
          </dd>
          {cfg.allowedTools.includes("post_slack_message") && (
            <>
              <dt className="text-muted-foreground">Slack</dt>
              <dd className="font-medium">{cfg.guardrails.allowedSlackChannels.join(", ") || "None"}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Model</dt>
          <dd className="font-medium">{modelInfo(cfg.model).label}</dd>
        </dl>
        <details className="group mt-6">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[14px] font-semibold text-muted-foreground hover:text-foreground">
            Show full configuration <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-4">
            <ConfigCard config={cfg} catalog={props.catalog} models={props.models} workspace={props.workspace} readOnly />
          </div>
        </details>
      </Panel>
    </div>
  );
}

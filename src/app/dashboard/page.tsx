import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { Activity, Plus } from "lucide-react";
import { AuditList } from "@/components/audit-list";
import { RunsChart } from "@/components/runs-chart";
import { Mrkdwn } from "@/components/slack-preview";
import { AgentStatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, EmptyState, PageHeader, Stat } from "@/components/ui/primitives";
import { listAgents, pendingApprovalCount, recentAudit, recentSlack, runTimeline, totals } from "@/lib/queries";
import { formatMs, formatUsd, pct, timeAgo } from "@/lib/utils";

export default async function DashboardPage() {
  const [t, agents, pending, timeline, audit, slack] = await Promise.all([totals(), listAgents(), pendingApprovalCount(), runTimeline(), recentAudit(14), recentSlack(6)]);
  const completed = t.handled + t.flagged + t.failed;
  const now = Date.now();

  return (
    <>
      <PageHeader
        title="Monitoring"
        description="Every agent run, tool call and approval across the workspace. Stored in Postgres, so this is the same log your auditors would see."
        actions={
          <Button asChild>
            <Link href="/agents/new">
              <Plus /> New agent
            </Link>
          </Button>
        }
      />

      <AutoRefresh />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Agent runs" value={t.runs} hint={`${t.toolCalls} tool calls`} />
        <Stat label="Success rate" value={completed ? `${pct(t.handled, completed)}%` : "—"} tone="success" hint="handled without a human" />
        <Stat label="Routed to humans" value={t.flagged} tone={t.flagged ? "warning" : undefined} hint="flagged by agents or guardrails" />
        <Stat
          label="Pending approvals"
          value={
            <Link href="/approvals" className="hover:underline">
              {pending}
            </Link>
          }
          tone={pending ? "warning" : undefined}
          hint="refunds, customer emails"
        />
        <Stat label="Est. spend" value={formatUsd(t.cost, 2)} hint={`${(t.tokens / 1000).toFixed(1)}K tokens`} />
        <Stat label="SerpApi searches" value={t.searches} hint={t.avgMs ? `avg run ${formatMs(t.avgMs)}` : "live web + news"} />
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Run outcomes, last 6 hours</CardTitle>
          <CardDescription>15-minute buckets. Hover a column for counts.</CardDescription>
        </CardHeader>
        <div className="px-5 pt-3 pb-5">
          {t.runs ? <RunsChart rows={timeline.rows} engine={timeline.engine} /> : <EmptyState icon={<Activity />} title="No runs yet">Test an agent and its runs show up here.</EmptyState>}
        </div>
      </Card>

      <h2 className="mt-8 mb-3 text-[15px] font-semibold tracking-tight">Agents</h2>
      {agents.length ? (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Agent</th>
                <th className="px-4 py-2 text-right font-medium">Runs</th>
                <th className="px-4 py-2 text-right font-medium">Handled</th>
                <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">Flagged</th>
                <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">Failed</th>
                <th className="hidden px-4 py-2 text-right font-medium md:table-cell">Avg time</th>
                <th className="px-4 py-2 text-right font-medium">Est. cost</th>
                <th className="hidden px-4 py-2 text-right font-medium md:table-cell">Last run</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {agents.map(({ agent, stats: s }) => (
                <tr key={agent.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <Link href={`/agents/${agent.id}`} className="flex items-center gap-2 font-medium hover:text-primary">
                      {agent.name} <AgentStatusBadge status={agent.status} />
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{s.runs}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{s.runs ? `${pct(s.handled, s.runs)}%` : "—"}</td>
                  <td className="hidden px-4 py-2.5 text-right tabular-nums sm:table-cell">{s.flagged + s.waiting}</td>
                  <td className="hidden px-4 py-2.5 text-right tabular-nums sm:table-cell">{s.failed}</td>
                  <td className="hidden px-4 py-2.5 text-right tabular-nums md:table-cell">{s.avgMs ? formatMs(s.avgMs) : "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatUsd(s.cost, 3)}</td>
                  <td className="hidden px-4 py-2.5 text-right text-xs text-muted-foreground md:table-cell">{timeAgo(s.lastRunAt, now)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState
          title="No agents yet"
          action={
            <Button asChild>
              <Link href="/agents/new">Create one</Link>
            </Button>
          }
        >
          It takes about a minute.
        </EmptyState>
      )}

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle>Recent activity</CardTitle>
            <Link href="/activity" className="text-xs text-muted-foreground hover:text-primary">
              Full audit log →
            </Link>
          </CardHeader>
          <AuditList entries={audit} dense />
        </Card>
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle>Posted to Slack</CardTitle>
          </CardHeader>
          {slack.length ? (
            <ul className="divide-y">
              {slack.map((m) => (
                <li key={m.id} className="px-4 py-2.5 text-[13px]">
                  <div className="mb-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-mono">{m.channel}</span>
                    <span>{m.delivered ? "delivered" : "kept in Harbor"}</span>
                    <span className="ml-auto">{timeAgo(m.createdAt, now)}</span>
                  </div>
                  <div className="line-clamp-3 break-words">
                    <Mrkdwn text={m.text} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 pb-6 text-sm text-muted-foreground">Urgent tickets and approval requests show up here.</p>
          )}
        </Card>
      </div>
    </>
  );
}

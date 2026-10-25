import Link from "next/link";
import { ChevronRight, Clock3 } from "lucide-react";
import { AgentOrb } from "@/components/agent-orb";
import { AutoRefresh } from "@/components/auto-refresh";
import { ActivityCard, AgentCard, GoLiveCard, WorkloadCard } from "@/components/home/cards";
import { BuildAgentCard } from "@/components/home/client-bits";
import { PerformanceChart } from "@/components/performance-chart";
import { RunBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/primitives";
import { activityFeed, listAgents, recentRuns, runSeries, totals } from "@/lib/queries";
import { getWorkspace } from "@/lib/seed";
import { formatMs } from "@/lib/utils";

export default async function HomePage() {
  const [ws, t, agents, series, feed, runs] = await Promise.all([getWorkspace(), totals(), listAgents(), runSeries(), activityFeed(7), recentRuns({ limit: 5 })]);
  const featured = agents.find((a) => a.agent.status === "live") ?? agents[0] ?? null;
  const lastRun = featured ? ((await recentRuns({ agentId: featured.agent.id, limit: 1 }))[0] ?? null) : null;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <AutoRefresh />
      <AgentCard featured={featured} lastRun={lastRun} defaultModel={ws.defaultModel} />
      <BuildAgentCard />
      <WorkloadCard t={t} />
      <GoLiveCard />

      <Panel title="Performance" actions={<span className="rounded-[10px] bg-muted px-3.5 py-2 text-[14px] font-semibold">{series.label}</span>}>
        <PerformanceChart rows={series.rows} hours={series.hours} minutes={series.minutes} engine={series.engine} />
      </Panel>
      <ActivityCard feed={feed} people={{ [ws.ownerEmail]: ws.ownerName }} />

      <Panel
        title="Recent runs"
        className="xl:col-span-2"
        actions={
          <Button variant="outline" asChild>
            <Link href="/agents">All agents</Link>
          </Button>
        }
      >
        {runs.length ? (
          <ul className="space-y-2">
            {runs.map(({ run, ticket, agentName }) => {
              const ms = run.startedAt ? (run.endedAt ? run.endedAt.getTime() : Date.now()) - run.startedAt.getTime() : 0;
              return (
                <li key={run.id}>
                  <Link
                    href={`/runs/${run.id}`}
                    className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl px-2 py-2 transition-colors hover:bg-muted md:grid-cols-[auto_minmax(0,1fr)_170px_90px_auto]"
                  >
                    <span className="flex size-12 items-center justify-center rounded-xl bg-muted transition-colors group-hover:bg-card">
                      <AgentOrb seed={agentName} size={22} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold">{ticket?.subject ?? "Run"}</div>
                      <div className="truncate text-[13px] text-muted-foreground">
                        {agentName} · <span className="tabular-nums">{ticket?.id}</span>
                      </div>
                    </div>
                    <span className="hidden md:block">
                      <RunBadge status={run.status} outcome={run.outcome} />
                    </span>
                    <span className="hidden items-center gap-1.5 text-[14px] font-medium tabular-nums md:flex">
                      <Clock3 className="size-4 text-muted-foreground" />
                      {ms ? formatMs(ms) : "—"}
                    </span>
                    <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-2xl bg-muted px-5 py-8 text-center text-[14px] text-muted-foreground">
            No runs yet. Describe an agent above and it&apos;s tested on 10 sample tickets before it goes live.
          </p>
        )}
      </Panel>
    </div>
  );
}

import { AutoRefresh } from "@/components/auto-refresh";
import { ActivityCard, AgentCard, GoLiveCard, WorkloadCard } from "@/components/home/cards";
import { BuildAgentCard } from "@/components/home/client-bits";
import { PerformanceChart } from "@/components/performance-chart";
import { Panel } from "@/components/ui/primitives";
import { activityFeed, listAgents, recentRuns, runSeries, totals } from "@/lib/queries";
import { getWorkspace } from "@/lib/seed";

export default async function HomePage() {
  const [ws, t, agents, series, feed] = await Promise.all([getWorkspace(), totals(), listAgents(), runSeries(), activityFeed(7)])
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

    </div>
  );
}

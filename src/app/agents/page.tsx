import Link from "next/link";
import { Bot, Plus } from "lucide-react";
import { AgentStatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { modelInfo } from "@/lib/llm/models";
import { listAgents } from "@/lib/queries";
import { formatUsd, pct, timeAgo } from "@/lib/utils";

export default async function AgentsPage() {
  const agents = await listAgents();
  const now = Date.now();
  return (
    <>
      <PageHeader
        title="Agents"
        description="Every agent shares the workspace's connections, model and policies. Each one gets its own permissions, guardrails and log."
        actions={
          <Button asChild>
            <Link href="/agents/new">
              <Plus /> New agent
            </Link>
          </Button>
        }
      />
      {!agents.length ? (
        <EmptyState
          icon={<Bot />}
          title="No agents yet"
          action={
            <Button asChild>
              <Link href="/agents/new">Describe your first agent</Link>
            </Button>
          }
        >
          Describe a job in plain English and Harbor builds the agent, tests it on sample tickets and deploys it with guardrails.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {agents.map(({ agent, template, stats }) => (
            <Link key={agent.id} href={`/agents/${agent.id}`} className="group">
              <Card className="h-full p-5 transition-shadow group-hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Bot className="size-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold tracking-tight group-hover:text-primary">{agent.name}</span>
                      <AgentStatusBadge status={agent.status} />
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{template.description}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {template.allowedTools.map((t) => (
                    <Badge key={t} variant={template.riskyTools.includes(t) ? "warning" : "outline"} className="font-mono text-[11px] font-normal">
                      {t}
                    </Badge>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2 border-t pt-3 text-xs">
                  <Mini label="Runs" value={stats.runs} />
                  <Mini label="Handled" value={`${pct(stats.handled, stats.runs)}%`} />
                  <Mini label="Cost" value={formatUsd(stats.cost, 2)} />
                  <Mini label="Last run" value={timeAgo(stats.lastRunAt, now)} />
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">{modelInfo(template.model).label}</div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium tabular-nums">{value}</div>
    </div>
  );
}

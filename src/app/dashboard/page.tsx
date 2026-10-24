import Link from "next/link";
import { CalendarDays, CircleDollarSign, Clock3, Gauge, MoreHorizontal, ThumbsUp } from "lucide-react";
import { AgentOrb } from "@/components/agent-orb";
import { AutoRefresh } from "@/components/auto-refresh";
import { TodayLabel } from "@/components/home/client-bits";
import { RightRail } from "@/components/home/right-rail";
import { PerformanceChart } from "@/components/performance-chart";
import { activityFeed, listAgents, pendingApprovalCount, recentRuns, runSeries, totals } from "@/lib/queries";
import { getWorkspace } from "@/lib/seed";
import { cn, formatMs, formatUsd, pct } from "@/lib/utils";

const STATUS: Record<string, { label: string; dot: string }> = {
  queued: { label: "Queued", dot: "bg-muted-foreground/50" },
  running: { label: "In progress", dot: "bg-series-2" },
  awaiting_approval: { label: "Needs approval", dot: "bg-series-1" },
  handled: { label: "Handled", dot: "bg-success" },
  flagged: { label: "Flagged", dot: "bg-warning" },
  failed: { label: "Failed", dot: "bg-danger" },
};

function statusKey(status: string, outcome: string | null) {
  if (status === "completed") return outcome === "flagged" ? "flagged" : "handled";
  return status in STATUS ? status : "failed";
}

function KpiStat({ icon: Icon, label, value, hint, tone }: { icon: React.ElementType; label: string; value: React.ReactNode; hint: string; tone: "good" | "attention" | "neutral" }) {
  return (
    <div className="flex items-center gap-4 py-1">
      <span className="flex size-[60px] shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="size-[22px]" strokeWidth={1.8} />
      </span>
      <div>
        <div className="text-[15px] text-foreground/80">{label}</div>
        <div className="mt-0.5 flex items-baseline gap-2.5">
          <span className="text-[26px] font-semibold tracking-tight tabular-nums">{value}</span>
          <span className={cn("text-[14px] whitespace-nowrap", tone === "good" ? "text-success" : tone === "attention" ? "text-series-2" : "text-muted-foreground")}>{hint}</span>
        </div>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const [ws, t, agents, pending, series, feed, runs] = await Promise.all([
    getWorkspace(),
    totals(),
    listAgents(),
    pendingApprovalCount(),
    runSeries(),
    activityFeed(7),
    recentRuns({ limit: 5 }),
  ]);
  const featured = agents.find((a) => a.agent.status === "live") ?? agents[0] ?? null;
  const done = t.handled + t.flagged + t.failed;
  const firstName = ws.ownerName.split(" ")[0];
  const subtitle = pending
    ? `${pending} ${pending === 1 ? "action is" : "actions are"} waiting for your approval. Everything else is on track.`
    : t.runs
      ? `Your agents handled ${t.handled} of ${t.runs} tickets. ${t.flagged ? `${t.flagged} went to a human.` : "Nothing needs you right now."}`
      : "Describe your first agent and it'll be working tickets in about a minute.";

  return (
    // Bleeds to the window edges so the right rail can run full height, like the reference layout.
    <div className="-mx-5 -my-8 grid md:-mx-12 md:-my-11 xl:grid-cols-[minmax(0,1fr)_400px]">
      <AutoRefresh />
      <div className="min-w-0 px-5 py-8 md:px-12 md:py-11">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="display text-[44px]">Hello, {firstName}</h1>
            <p className="mt-2 text-[16px] text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <TodayLabel />
            <Link href="/activity" aria-label="Activity log" className="flex size-12 items-center justify-center rounded-full bg-muted transition-colors hover:bg-tile-hover">
              <CalendarDays className="size-5" strokeWidth={1.8} />
            </Link>
          </div>
        </header>

        <section className="mt-9 grid gap-6 border-y py-7 sm:grid-cols-3 sm:gap-0 sm:divide-x">
          <div className="sm:pr-6">
            <KpiStat icon={ThumbsUp} label="Handled" value={t.handled} hint={t.runs ? `of ${t.runs} runs` : "no runs yet"} tone="good" />
          </div>
          <div className="sm:px-6">
            <KpiStat icon={CircleDollarSign} label="Est. spend" value={formatUsd(t.cost, 2)} hint={`${(t.tokens / 1000).toFixed(1)}K tokens`} tone="neutral" />
          </div>
          <div className="sm:pl-6">
            <KpiStat icon={Gauge} label="Success rate" value={done ? `${pct(t.handled, done)}%` : "—"} hint={`${t.flagged} to humans`} tone={t.flagged ? "attention" : "good"} />
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="display text-[28px]">Performance</h2>
            <span className="rounded-full bg-muted px-4 py-2 text-[14px]">{series.label}</span>
          </div>
          <PerformanceChart rows={series.rows} hours={series.hours} minutes={series.minutes} engine={series.engine} />
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-center gap-5">
            <h2 className="display text-[28px]">Recent runs</h2>
            <span className="h-7 w-px bg-border" />
            <span className="text-[15px]">Handled {done ? pct(t.handled, done) : 0}%</span>
            <Link href="/agents" className="ml-auto rounded-full border px-4 py-1.5 text-[14px] transition-colors hover:bg-muted">
              All agents
            </Link>
          </div>
          {runs.length ? (
            <ul>
              {runs.map(({ run, ticket, agentName }) => {
                const s = STATUS[statusKey(run.status, run.outcome)];
                const ms = run.startedAt ? (run.endedAt ? run.endedAt.getTime() : Date.now()) - run.startedAt.getTime() : 0;
                return (
                  <li key={run.id}>
                    <Link href={`/runs/${run.id}`} className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl py-3 md:grid-cols-[auto_minmax(0,1fr)_150px_80px_auto]">
                      <span className="flex size-14 items-center justify-center rounded-full bg-muted transition-colors group-hover:bg-tile-hover">
                        <AgentOrb seed={agentName} size={22} />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-medium">{ticket?.subject ?? "Run"}</div>
                        <div className="truncate text-[13px] text-muted-foreground">
                          {agentName} · {ticket?.id}
                        </div>
                      </div>
                      <span className="hidden items-center gap-2 text-[14px] md:flex">
                        <span className={cn("size-2 rounded-full", s.dot)} />
                        {s.label}
                      </span>
                      <span className="hidden items-center gap-1.5 text-[14px] font-medium tabular-nums md:flex">
                        <Clock3 className="size-4 text-muted-foreground" />
                        {ms ? formatMs(ms) : "—"}
                      </span>
                      <MoreHorizontal className="size-5 text-muted-foreground group-hover:text-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-2xl bg-muted/60 px-5 py-8 text-center text-sm text-muted-foreground">
              No runs yet.{" "}
              <Link href="/agents/new" className="font-medium text-foreground underline-offset-4 hover:underline">
                Create an agent
              </Link>{" "}
              and test it on 10 tickets.
            </p>
          )}
        </section>
      </div>

      <aside className="border-t px-6 py-8 xl:sticky xl:top-0 xl:h-screen xl:self-start xl:border-t-0 xl:border-l xl:py-6">
        <RightRail featured={featured} feed={feed} people={{ [ws.ownerEmail]: ws.ownerName }} />
      </aside>
    </div>
  );
}

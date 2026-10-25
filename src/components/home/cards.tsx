import Link from "next/link";
import { ArrowUpRight, BadgeDollarSign, Mail } from "lucide-react";
import { AgentOrb } from "@/components/agent-orb";
import { Mascot } from "@/components/mascots/mascot";
import { Mrkdwn } from "@/components/slack-preview";
import { AgentStatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Label, Panel } from "@/components/ui/primitives";
import { modelInfo } from "@/lib/llm/models";
import { ALL_MASCOTS } from "@/lib/mascots";
import type { AgentRow, FeedItem, recentRuns, totals } from "@/lib/queries";
import { integrationStatus } from "@/lib/queries";
import { cn, formatUsd, pct, timeAgo } from "@/lib/utils";
import { ApproveAllButton } from "./client-bits";

type RunRow = Awaited<ReturnType<typeof recentRuns>>[number];
type Totals = Awaited<ReturnType<typeof totals>>;

/** Read-only gray field with one icon action on the right, like the reference's ID box. */
function Field({ id, value, action }: { id: string; value: React.ReactNode; action?: { href: string; label: string; icon: React.ElementType } }) {
  const Icon = action?.icon;
  return (
    <div id={id} className="mt-2 flex h-12 items-center gap-3 rounded-xl border border-white/80 bg-white/55 pr-2 pl-4">
      <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{value}</span>
      {action && Icon && (
        <Link
          href={action.href}
          aria-label={action.label}
          title={action.label}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white hover:text-foreground"
        >
          <Icon className="size-[19px]" strokeWidth={1.8} />
        </Link>
      )}
    </div>
  );
}

const runLabel = (run: RunRow["run"]) =>
  run.status === "completed" ? (run.outcome === "flagged" ? "Sent to a human" : "Handled") : run.status === "awaiting_approval" ? "Needs approval" : run.status === "failed" ? "Failed" : "Running";

/** Top-left card: the workspace's main agent at a glance. */
export function AgentCard({ featured, lastRun, defaultModel }: { featured: AgentRow | null; lastRun: RunRow | null; defaultModel: string }) {
  if (!featured)
    return (
      <Panel
        variant="glass"
        title="No agents yet"
        description="Describe a job and Harbor builds, tests and deploys an agent in about a minute."
        actions={<Mascot kinds={["murmur"]} width={88} height={88} className="-my-4" label="Harbor mascot" />}
      >
        <Button asChild>
          <Link href="/agents/new">Create your first agent</Link>
        </Button>
        <span className="sr-only">Default model: {modelInfo(defaultModel).label}</span>
      </Panel>
    );
  const { agent, template, stats } = featured;
  return (
    <Panel
      variant="glass"
      title={
        <Link href={`/agents/${agent.id}`} className="flex items-center gap-3 hover:underline">
          <AgentOrb seed={agent.name} size={26} live={agent.status === "live"} />
          {agent.name}
        </Link>
      }
      description={stats.runs ? `${stats.runs} ${stats.runs === 1 ? "run" : "runs"} · ${pct(stats.handled, stats.runs)}% handled without a person.` : template.description}
      actions={<AgentStatusBadge status={agent.status} />}
    >
      <Label htmlFor="agent-last">Last run</Label>
      <Field
        id="agent-last"
        value={
          lastRun ? (
            <>
              {lastRun.ticket?.id} · {runLabel(lastRun.run)} <span className="font-normal text-muted-foreground">· {timeAgo(lastRun.run.createdAt)}</span>
            </>
          ) : (
            <span className="text-muted-foreground">No runs yet</span>
          )
        }
        action={lastRun ? { href: `/runs/${lastRun.run.id}`, label: "Open run", icon: ArrowUpRight } : undefined}
      />
      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`/agents/${agent.id}`}>Open agent</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/agents">All agents</Link>
        </Button>
      </div>
    </Panel>
  );
}

/** Bottom-left card: where every run ended up, as a segmented bar plus four labeled tiles. */
export function WorkloadCard({ t }: { t: Totals }) {
  const done = t.handled + t.flagged + t.failed;
  const segments = [
    { key: "handled", label: "Handled", sub: "by agents, end to end", n: t.handled, color: "bg-series-1" },
    { key: "human", label: "Sent to a human", sub: "flagged for your team", n: t.flagged, color: "bg-series-2" },
    { key: "waiting", label: "Waiting on you", sub: "paused for approval", n: t.waiting, color: "bg-series-3" },
    { key: "failed", label: "Failed", sub: "errors or budget stops", n: t.failed, color: "bg-series-4" },
  ];
  return (
    <Panel
      variant="glass"
      title="Ticket workload"
      description={`${formatUsd(t.cost, 2)} estimated spend on ${t.tokens.toLocaleString()} tokens.`}
      actions={
        <Button variant="outline" asChild>
          <Link href="/inbox">Open inbox</Link>
        </Button>
      }
    >
      <div className="rounded-2xl border border-white/80 bg-white/45 px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-[15px] text-muted-foreground">
            <span className="text-[20px] font-semibold text-foreground tabular-nums">{t.handled}</span> /{" "}
            <span className="text-[20px] font-semibold text-foreground tabular-nums">{t.runs}</span> runs handled
          </div>
          <div className="text-[15px] text-muted-foreground">
            <span className="text-[20px] font-semibold text-foreground tabular-nums">{done ? pct(t.handled, done) : 0}</span> %
          </div>
        </div>
        <div
          role="img"
          aria-label={segments.map((s) => `${s.label}: ${s.n}`).join(", ")}
          className="mt-4 flex h-4 gap-[2px] overflow-hidden rounded-[4px] bg-black/[0.06]"
        >
          {segments
            .filter((s) => s.n > 0)
            .map((s) => (
              <span key={s.key} title={`${s.label}: ${s.n} of ${t.runs}`} className={cn("h-full first:rounded-l-[4px] last:rounded-r-[4px]", s.color)} style={{ width: `${(s.n / Math.max(t.runs, 1)) * 100}%` }} />
            ))}
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {segments.map((s) => (
          <div key={s.key} title={s.sub}>
            <dt className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <span className={cn("size-2 rounded-full", s.color)} />
              {s.label}
            </dt>
            <dd className="mt-1 text-[24px] font-semibold tabular-nums">{s.n}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

/** Bottom-right promo card: what is still simulated, with the agents' gradient orbs standing in for the 3D art. */
export function GoLiveCard() {
  const s = integrationStatus();
  const simulated = [!s.llm.live && "the model", !s.serpapi.live && "SerpApi", !s.slack.live && "Slack"].filter(Boolean) as string[];
  const allLive = simulated.length === 0;
  const list = simulated.join(", ").replace(/, ([^,]*)$/, " and $1");
  return (
    <section className="glass relative flex min-h-[340px] flex-col justify-center overflow-hidden rounded-[24px] p-6 sm:flex-row sm:items-center sm:justify-start md:p-8">
      <div className="relative z-10 max-w-[270px]">
        <h2 className="display text-[24px]">{allLive ? "Harbor in full throttle!" : "Go live"}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          {allLive
            ? `The model, SerpApi and Slack are live, and every run is logged to ${s.db.label === "Tiger Cloud" ? "Tiger Postgres" : "Postgres"}.`
            : `${list.charAt(0).toUpperCase()}${list.slice(1)} ${simulated.length === 1 ? "is" : "are"} simulated. Add keys to run on the real services.`}
        </p>
        <Button variant="outline" asChild className="mt-6">
          <Link href={allLive ? "/activity" : "/onboarding"}>{allLive ? "View activity" : "Connect"}</Link>
        </Button>
      </div>
      <Mascot kinds={ALL_MASCOTS} width={340} height={250} className="mx-auto mt-4 sm:absolute sm:-right-2 sm:bottom-3 sm:mt-0" label="Harbor's mascots" />
    </section>
  );
}

function Avatar({ agentName, person }: { agentName: string | null; person?: string }) {
  if (agentName) return <AgentOrb seed={agentName} size={40} />;
  const initials = (person ?? "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#f1e4d8] text-[13px] font-bold text-[#7a4b2a]">{initials}</span>;
}

function FeedHeader({ name, at }: { name: string; at: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="truncate text-[15px] font-semibold">{name}</span>
      <span className="shrink-0 text-[13px] text-muted-foreground">{at}</span>
    </div>
  );
}

function FeedRow({ item, people }: { item: FeedItem; people: Record<string, string> }) {
  const now = Date.now();
  if (item.kind === "approval") {
    return (
      <li className="flex gap-3.5">
        <Avatar agentName={item.agentName} />
        <div className="min-w-0 flex-1">
          <FeedHeader name={item.agentName} at={timeAgo(item.at, now)} />
          <p className="text-[14px] text-muted-foreground">
            Needs approval on{" "}
            <Link href={`/runs/${item.runId}`} className="font-medium text-foreground underline-offset-4 hover:underline">
              {item.ticketId ?? "a run"}
            </Link>
          </p>
          <div className="mt-3 space-y-3 rounded-2xl bg-muted px-4 py-3.5">
            {item.actions.map((a) => {
              const refund = a.action === "issue_refund";
              const Icon = refund ? BadgeDollarSign : Mail;
              return (
                <div key={a.approvalId} className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card shadow-[0_1px_2px_rgba(16,24,40,0.08)]">
                    <Icon className="size-[18px]" strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0 text-[14px] leading-snug">
                    <div className="truncate font-semibold">{refund ? `Refund ${formatUsd(Number(a.args.amount_usd), 2)}` : String(a.args.subject ?? "Email the customer")}</div>
                    <div className="truncate text-[13px] text-muted-foreground">{refund ? String(a.args.invoice_id || "issue_refund") : "Email to the customer"}</div>
                  </div>
                </div>
              );
            })}
            <ApproveAllButton approvalIds={item.actions.map((a) => a.approvalId)} reviewHref={`/runs/${item.runId}`} />
          </div>
        </div>
      </li>
    );
  }
  if (item.kind === "slack")
    return (
      <li className="flex gap-3.5">
        <Avatar agentName={item.agentName ?? "Harbor"} />
        <div className="min-w-0 flex-1">
          <FeedHeader name={item.agentName ?? "Harbor"} at={timeAgo(item.at, now)} />
          <p className="text-[14px] text-muted-foreground">
            Posted to{" "}
            {item.runId ? (
              <Link href={`/runs/${item.runId}`} className="font-medium text-foreground underline-offset-4 hover:underline">
                {item.channel}
              </Link>
            ) : (
              <span className="font-medium text-foreground">{item.channel}</span>
            )}
          </p>
          <div className="mt-3 line-clamp-4 rounded-2xl rounded-tl-md bg-muted px-4 py-3 text-[14px] leading-relaxed break-words text-foreground/90">
            <Mrkdwn text={item.text.replace(/^:test_tube: _Test run_ · /, "")} />
          </div>
        </div>
      </li>
    );
  const isAgent = item.actor.startsWith("agent:");
  const name = isAgent ? item.actor.slice(6) : (people[item.actor] ?? item.actor);
  return (
    <li className="flex gap-3.5">
      <Avatar agentName={isAgent ? name : null} person={name} />
      <div className="min-w-0 flex-1">
        <FeedHeader name={name} at={timeAgo(item.at, now)} />
        <p className="text-[14px] text-muted-foreground">
          {item.href ? (
            <Link href={item.href} className="underline-offset-4 hover:text-foreground hover:underline">
              {item.text}
            </Link>
          ) : (
            item.text
          )}
        </p>
      </div>
    </li>
  );
}

export function ActivityCard({ feed, people }: { feed: FeedItem[]; people: Record<string, string> }) {
  return (
    <Panel
      title="Activity"
      actions={
        <Button variant="outline" asChild>
          <Link href="/activity">Full log</Link>
        </Button>
      }
    >
      <ul className="-mr-3 max-h-[392px] space-y-6 overflow-y-auto pr-3">
        {feed.length ? (
          feed.map((item, i) => <FeedRow key={`${item.kind}-${i}`} item={item} people={people} />)
        ) : (
          <li className="rounded-2xl bg-muted px-5 py-10 text-center text-[14px] text-muted-foreground">Agent activity shows up here as they work.</li>
        )}
      </ul>
    </Panel>
  );
}

import Link from "next/link";
import { Activity, ArrowUpRight, BadgeDollarSign, Mail, MoreVertical, SlidersHorizontal } from "lucide-react";
import { AgentOrb } from "@/components/agent-orb";
import { Mrkdwn } from "@/components/slack-preview";
import type { AgentRow, FeedItem } from "@/lib/queries";
import { cn, formatUsd, pct, timeAgo } from "@/lib/utils";
import { AgentComposer, ApproveAllButton } from "./client-bits";

const handle = (name: string) => `@${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

function RoundAction({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="flex size-[52px] items-center justify-center rounded-full bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-transform hover:-translate-y-0.5 [&_svg]:size-5"
    >
      {children}
    </Link>
  );
}

export function AgentProfileCard({ featured }: { featured: AgentRow | null }) {
  if (!featured)
    return (
      <div className="rounded-[28px] bg-muted/70 px-6 py-9 text-center">
        <div className="mx-auto size-24 rounded-full border-2 border-dashed border-input" />
        <div className="mt-4 text-[17px] font-medium">No agents yet</div>
        <p className="mt-1 text-sm text-muted-foreground">Describe one below and it&apos;s live in a minute.</p>
      </div>
    );
  const { agent, stats } = featured;
  const live = agent.status === "live";
  return (
    <div className="rounded-[28px] bg-muted/70 px-6 pt-9 pb-7 text-center">
      <div className="relative mx-auto size-28">
        <AgentOrb seed={agent.name} size={112} className="drop-shadow-[0_12px_24px_rgba(0,0,0,0.18)]" />
        <span
          className={cn("absolute right-2 bottom-2 size-5 rounded-full border-[3px] border-[#f6f6f4]", live ? "bg-success" : "bg-muted-foreground/40")}
          title={live ? "Live" : "Not deployed"}
        />
      </div>
      <Link href={`/agents/${agent.id}`} className="mt-4 block text-[19px] font-medium tracking-tight hover:underline">
        {agent.name}
      </Link>
      <div className="mt-0.5 text-[14px] text-muted-foreground">
        {handle(agent.name)} · {live ? "live" : agent.status}
        {stats.runs ? ` · ${pct(stats.handled, stats.runs)}% handled` : ""}
      </div>
      <div className="mt-6 flex justify-center gap-4">
        <RoundAction href={`/agents/${agent.id}`} label="Runs and stats">
          <Activity />
        </RoundAction>
        <RoundAction href={`/agents/new?draft=${agent.id}`} label="Edit and re-test">
          <SlidersHorizontal />
        </RoundAction>
        <RoundAction href="/agents" label="All agents">
          <MoreVertical />
        </RoundAction>
      </div>
    </div>
  );
}

function Avatar({ agentName, person }: { agentName: string | null; person?: string }) {
  if (agentName) return <AgentOrb seed={agentName} size={44} />;
  const initials = (person ?? "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#f1e4d8] text-[13px] font-semibold text-[#7a4b2a]">{initials}</span>;
}

function FeedRow({ item, people }: { item: FeedItem; people: Record<string, string> }) {
  const now = Date.now();
  if (item.kind === "approval") {
    return (
      <li className="flex gap-3.5">
        <Avatar agentName={item.agentName} />
        <div className="min-w-0 flex-1">
          <Header name={item.agentName} at={timeAgo(item.at, now)} />
          <p className="text-[14px] text-muted-foreground">
            Needs approval on{" "}
            <Link href={`/runs/${item.runId}`} className="text-[#2f6fd0] hover:underline">
              {item.ticketId ?? "a run"}
            </Link>
          </p>
          <div className="mt-3 space-y-3 rounded-2xl bg-soft-blue px-4 py-3.5">
            {item.actions.map((a) => {
              const refund = a.action === "issue_refund";
              const Icon = refund ? BadgeDollarSign : Mail;
              return (
                <div key={a.approvalId} className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#141414] text-white">
                    <Icon className="size-[18px]" />
                  </span>
                  <div className="min-w-0 text-[14px] leading-snug">
                    <div className="truncate font-medium">{refund ? `Refund ${formatUsd(Number(a.args.amount_usd), 2)}` : String(a.args.subject ?? "Email the customer")}</div>
                    <div className="truncate text-[13px] text-muted-foreground">{refund ? String(a.args.invoice_id || "issue_refund") : `Email to the customer`}</div>
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
          <Header name={item.agentName ?? "Harbor"} at={timeAgo(item.at, now)} />
          <p className="text-[14px] text-muted-foreground">
            Posted to{" "}
            {item.runId ? (
              <Link href={`/runs/${item.runId}`} className="text-[#2f6fd0] hover:underline">
                {item.channel}
              </Link>
            ) : (
              <span className="text-[#2f6fd0]">{item.channel}</span>
            )}
          </p>
          <div className="mt-3 line-clamp-4 rounded-2xl rounded-tl-md bg-soft-blue px-4 py-3 text-[14px] leading-relaxed break-words text-foreground/90">
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
        <Header name={name} at={timeAgo(item.at, now)} />
        <p className="text-[14px] text-muted-foreground">
          {item.href ? (
            <Link href={item.href} className="text-[#2f6fd0] hover:underline">
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

function Header({ name, at }: { name: string; at: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="truncate text-[15px] font-medium">{name}</span>
      <span className="shrink-0 text-[13px] text-muted-foreground">{at}</span>
    </div>
  );
}

export function RightRail({ featured, feed, people }: { featured: AgentRow | null; feed: FeedItem[]; people: Record<string, string> }) {
  return (
    <div className="flex h-full flex-col">
      <AgentProfileCard featured={featured} />
      <div className="my-7 flex items-center gap-4 text-[15px] text-foreground/80">
        <span className="h-px flex-1 bg-border" />
        Activity
        <span className="h-px flex-1 bg-border" />
      </div>
      <ul className="-mr-2 min-h-0 flex-1 space-y-7 overflow-y-auto pr-2">
        {feed.length ? (
          feed.map((item, i) => <FeedRow key={`${item.kind}-${i}`} item={item} people={people} />)
        ) : (
          <li className="py-8 text-center text-sm text-muted-foreground">Agent activity shows up here as they work.</li>
        )}
      </ul>
      <div className="pt-5">
        <AgentComposer />
        <Link href="/activity" className="mt-3 flex items-center justify-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
          Full audit log <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

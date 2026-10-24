import Link from "next/link";
import { Bot, Check, Copy, FileCog, Hand, Play, RotateCcw, Rocket, Search, Settings2, UserRound, Wrench, X } from "lucide-react";
import type { AuditEntry } from "@/lib/db/schema";
import { cn, formatUsd, timeAgo } from "@/lib/utils";
import { AgentOrb } from "@/components/agent-orb";

type D = Record<string, unknown>;

function describe(e: AuditEntry): { text: React.ReactNode; icon: React.ElementType; href?: string; tone?: string } {
  const d = e.details as D;
  switch (e.action) {
    case "agent.config_generated":
      return { text: <>generated an agent config from a description</>, icon: FileCog };
    case "agent.created":
      return { text: <>created agent <b>{String(d.name)}</b></>, icon: Bot, href: `/agents/${e.target}` };
    case "agent.updated":
      return { text: <>updated an agent&apos;s config</>, icon: FileCog, href: `/agents/${e.target}` };
    case "agent.deployed":
      return { text: <>deployed <b>{String(d.name)}</b></>, icon: Rocket, href: `/agents/${e.target}`, tone: "text-success" };
    case "agent.paused":
      return { text: <>paused <b>{String(d.name)}</b></>, icon: Hand, href: `/agents/${e.target}` };
    case "agent.cloned":
      return { text: <>cloned <b>{String(d.from)}</b> into <b>{String(d.to)}</b></>, icon: Copy, href: `/agents/${e.target}` };
    case "template.published":
      return { text: <>saved <b>{String(d.name)}</b> as a template</>, icon: Copy };
    case "template.used":
      return { text: <>started an agent from template <b>{String(d.name)}</b></>, icon: Copy };
    case "test_run.started":
      return { text: <>started a test run on {String(d.tickets)} tickets</>, icon: Play, href: `/agents/${e.target}` };
    case "run.started":
      return { text: <>started work on {String(d.ticket)}</>, icon: Play, href: `/runs/${e.target}` };
    case "run.completed":
      return {
        text: (
          <>
            finished a run: <b>{String(d.outcome)}</b> ({formatUsd(Number(d.cost ?? 0))})
          </>
        ),
        icon: Check,
        href: `/runs/${e.target}`,
        tone: d.outcome === "flagged" ? "text-warning" : "text-success",
      };
    case "run.failed":
      return { text: <>run failed: {String(d.error)}</>, icon: X, href: `/runs/${e.target}`, tone: "text-danger" };
    case "tool.called":
      return {
        text: (
          <>
            called <code className="font-mono text-[12px]">{String(d.tool)}</code>
            {d.approved_by ? <> (approved by {String(d.approved_by)})</> : null}
          </>
        ),
        icon: d.tool === "news_search" || d.tool === "web_search" ? Search : Wrench,
        href: `/runs/${e.target}`,
      };
    case "approval.requested":
      return { text: <>requested approval to <code className="font-mono text-[12px]">{String(d.tool)}</code></>, icon: Hand, href: "/approvals", tone: "text-warning" };
    case "approval.approved":
      return { text: <>approved <code className="font-mono text-[12px]">{String(d.tool)}</code></>, icon: Check, href: `/runs/${String(d.run)}`, tone: "text-success" };
    case "approval.rejected":
      return { text: <>rejected <code className="font-mono text-[12px]">{String(d.tool)}</code></>, icon: X, href: `/runs/${String(d.run)}`, tone: "text-danger" };
    case "workspace.onboarded":
      return { text: <>finished workspace setup</>, icon: Settings2 };
    case "workspace.updated":
      return { text: <>updated workspace settings</>, icon: Settings2 };
    case "connection.tested":
      return { text: <>tested the <b>{e.target}</b> connection: {d.live ? "live" : "simulated"}</>, icon: Settings2 };
    case "demo.reset":
      return { text: <>reset the demo</>, icon: RotateCcw };
    default:
      return { text: e.action, icon: FileCog };
  }
}

export function AuditList({ entries, dense }: { entries: AuditEntry[]; dense?: boolean }) {
  if (!entries.length) return <p className="px-4 py-6 text-center text-sm text-muted-foreground">No activity yet.</p>;
  const now = Date.now();
  return (
    <ul className="divide-y">
      {entries.map((e) => {
        const { text, icon: Icon, href, tone } = describe(e);
        const isAgent = e.actor.startsWith("agent:");
        const body = (
          <div className={cn("flex items-start gap-2.5 px-4", dense ? "py-2" : "py-2.5")}>
            <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted [&_svg]:size-3", tone)}>
              <Icon />
            </span>
            <div className="min-w-0 flex-1 text-[13px] leading-snug">
              <span className="font-medium">
                {isAgent ? (
                  <>
                    <AgentOrb seed={e.actor.slice(6)} size={10} className="mr-1 -translate-y-px align-middle" />
                    {e.actor.slice(6)}
                  </>
                ) : (
                  <>
                    <UserRound className="mr-0.5 inline size-3 -translate-y-px text-muted-foreground" />
                    {e.actor}
                  </>
                )}
              </span>{" "}
              <span className="text-foreground/80">{text}</span>
            </div>
            <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(e.createdAt, now)}</span>
          </div>
        );
        return <li key={`${e.id}`}>{href ? <Link href={href} className="block hover:bg-muted/40">{body}</Link> : body}</li>;
      })}
    </ul>
  );
}

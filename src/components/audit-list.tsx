import Link from "next/link";
import { Bot, Check, Copy, FileCog, Hand, Mail, Play, Rocket, RotateCcw, Search, Settings2, ShieldAlert, ShieldCheck, Sparkles, UserRound, Wrench, X } from "lucide-react";
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
    case "ticket.replied":
      return { text: <>replied to {e.target}{d.resolved ? " and resolved it" : ""}</>, icon: Mail, href: `/inbox?t=${e.target}` };
    case "ticket.resolved":
      return { text: <>resolved {e.target}</>, icon: Check, href: `/inbox?t=${e.target}`, tone: "text-success" };
    case "ticket.reopened":
      return { text: <>reopened {e.target}</>, icon: RotateCcw, href: `/inbox?t=${e.target}` };
    case "demo.redteam_reset":
      return { text: <>reset the red-team demo agent to v1</>, icon: RotateCcw, href: e.target ? `/agents/${e.target}` : undefined };
    case "redteam.started":
      return { text: <>started a red-team on v{String(d.version)}{d.purpose === "verify" ? " (re-verify)" : ""}</>, icon: ShieldAlert, href: d.agent ? `/agents/${String(d.agent)}` : undefined };
    case "redteam.completed":
      return {
        text: (
          <>
            red-team on v{String(d.version)}: <b>{String(d.score)}/{String(d.total)}</b> attacks stopped
          </>
        ),
        icon: ShieldAlert,
        href: d.agent ? `/agents/${String(d.agent)}` : undefined,
        tone: d.score === d.total ? "text-success" : "text-danger",
      };
    case "redteam.failed":
      return { text: <>red-team failed: {String(d.error)}</>, icon: ShieldAlert, tone: "text-danger" };
    case "heal.proposed":
      return { text: <>proposed a fix for {String(d.failures)} attack{d.failures === 1 ? "" : "s"}{Number(d.iteration) > 1 ? " (automatic)" : ""}</>, icon: Sparkles, href: d.agent ? `/agents/${String(d.agent)}` : undefined };
    case "heal.accepted":
      return { text: <>accepted the fix: v{String(d.from_version)} → v{String(d.to_version)}</>, icon: Check, href: d.agent ? `/agents/${String(d.agent)}` : undefined, tone: "text-success" };
    case "heal.rejected":
      return { text: <>rejected a proposed fix</>, icon: X, href: d.agent ? `/agents/${String(d.agent)}` : undefined };
    case "heal.verified":
      return { text: <>verified v{String(d.to_version)}: attacks {String(d.redteam)}, tests {String(d.tests)}</>, icon: ShieldCheck, href: d.agent ? `/agents/${String(d.agent)}` : undefined, tone: "text-success" };
    case "heal.regressed":
      return { text: <>found a regression in v{String(d.to_version)}{d.rolled_back ? " and rolled it back" : ""}</>, icon: ShieldAlert, href: d.agent ? `/agents/${String(d.agent)}` : undefined, tone: "text-warning" };
    case "heal.auto_iteration":
      return { text: <>tried another fix automatically</>, icon: Sparkles, href: d.agent ? `/agents/${String(d.agent)}` : undefined };
    case "heal.failed":
      return { text: <>couldn&apos;t verify a fix: {String(d.error)}</>, icon: ShieldAlert, tone: "text-danger" };
    case "agent.version_created":
      return { text: <>created version v{String(d.version)}</>, icon: FileCog, href: e.target ? `/agents/${e.target}` : undefined };
    case "agent.version_activated":
      return { text: <>switched to version v{String(d.version)}</>, icon: RotateCcw, href: e.target ? `/agents/${e.target}` : undefined };
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

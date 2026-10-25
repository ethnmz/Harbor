import Link from "next/link";
import { ArrowUpRight, CreditCard, Sparkles } from "lucide-react";
import { AgentOrb } from "@/components/agent-orb";
import { categoryLabel, RunBadge } from "@/components/status";
import { STATE_LABEL, type TicketState } from "@/lib/inbox";
import type { TicketThread } from "@/lib/queries";
import { cn, formatUsd, timeAgo } from "@/lib/utils";
import { DetailTabs } from "./actions";
import { channelOf } from "./parts";

const PRIORITY_TONE: Record<string, string> = { urgent: "text-danger", high: "text-[#d9622b]", normal: "text-foreground", low: "text-muted-foreground" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-black/[0.06] py-3 text-[15px] last:border-b-0">
      <span className="shrink-0 text-foreground/80">{label}:</span>
      <span className="min-w-0 truncate text-right font-medium">{children}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 mb-2 text-[15px] font-semibold text-muted-foreground first:mt-0">{children}</h3>;
}

/** Right pane: who the customer is, what they pay, and what the agents concluded. */
export function TicketDetails({ thread, state }: { thread: TicketThread; state: TicketState }) {
  const { ticket } = thread;
  const c = ticket.customer;
  const since = new Date(`${c.customerSince}T00:00:00Z`);
  const months = Math.max(1, Math.round((Date.now() - since.getTime()) / (30.44 * 86_400_000)));
  const lastRun = thread.runs.at(-1);
  const insight = ticket.triageNote ?? lastRun?.run.summary ?? null;
  const refunded = thread.refunds.reduce((s, r) => s + r.amountUsd, 0);

  const profile = (
    <div>
      <SectionTitle>Information</SectionTitle>
      <div>
        <Row label="Assignee">{lastRun ? lastRun.agentName : <span className="text-muted-foreground">Unassigned</span>}</Row>
        <Row label="Email">
          <a href={`mailto:${ticket.customerEmail}`} className="underline underline-offset-2">
            {ticket.customerEmail}
          </a>
        </Row>
        <Row label="Company">{ticket.company}</Row>
        <Row label="Plan">
          {c.plan} ({formatUsd(c.mrrUsd, 0)}/mo)
        </Row>
        <Row label="LTV (est.)">{formatUsd(c.mrrUsd * months, 0)}</Row>
        <Row label="Customer since">{since.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}</Row>
        <Row label="Priority">
          {ticket.urgency ? <span className={cn("font-semibold capitalize", PRIORITY_TONE[ticket.urgency])}>{ticket.urgency}</span> : <span className="text-muted-foreground">Not triaged</span>}
        </Row>
        {ticket.category && <Row label="Category">{categoryLabel(ticket.category)}</Row>}
        <Row label="Channel">{channelOf(ticket.channel).label}</Row>
      </div>

      <SectionTitle>Orders / Billing</SectionTitle>
      <ul className="space-y-2">
        {c.invoices.map((inv) => (
          <li key={inv.id} className="flex items-center gap-3 rounded-2xl border px-3.5 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#635bff] text-white">
              <CreditCard className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold">{inv.id}</div>
              <div className={cn("truncate text-[12px]", inv.status.includes("duplicate") ? "font-semibold text-[#d9622b]" : "text-muted-foreground")}>
                {new Date(`${inv.date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })} · {inv.status}
              </div>
            </div>
            <span className="text-[18px] font-semibold tabular-nums">{formatUsd(inv.amountUsd, 0)}</span>
          </li>
        ))}
        {refunded > 0 && (
          <li className="flex items-center justify-between rounded-2xl bg-success-soft px-3.5 py-2.5 text-[14px] font-semibold text-success">
            Refunded <span className="tabular-nums">−{formatUsd(refunded, 2)}</span>
          </li>
        )}
      </ul>

      <SectionTitle>AI insights</SectionTitle>
      <div className="rounded-2xl border px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <p className="text-[14px] leading-relaxed">
          {insight ? (
            <>
              <span className="font-semibold">Summary:</span> {insight}
            </>
          ) : (
            <span className="text-muted-foreground">No agent has looked at this ticket yet.</span>
          )}
        </p>
        <div className="mt-3 flex items-center gap-2 text-[14px]">
          Status:
          <span className="rounded-full bg-[#3c4867] px-3 py-1 text-[13px] font-semibold text-white">{STATE_LABEL[state]}</span>
          {lastRun && (
            <Link href={`/runs/${lastRun.run.id}`} className="ml-auto inline-flex items-center gap-1 text-[13px] font-semibold hover:underline">
              Timeline <ArrowUpRight className="size-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );

  const runs = (
    <ul className="space-y-2">
      {[...thread.runs].reverse().map(({ run, agentName }) => (
        <li key={run.id}>
          <Link href={`/runs/${run.id}`} className="block rounded-2xl border px-4 py-3 transition-colors hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <AgentOrb seed={agentName} size={18} />
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{agentName}</span>
              <RunBadge status={run.status} outcome={run.outcome} />
            </div>
            {run.summary && <p className="mt-1.5 line-clamp-2 text-[13px] text-muted-foreground">{run.summary}</p>}
            <div className="mt-1 text-[12px] text-muted-foreground">
              {run.trigger === "test" ? "Test run" : "Live run"} · {timeAgo(run.createdAt)} · {formatUsd(run.costEstimate)}
            </div>
          </Link>
        </li>
      ))}
      {!thread.runs.length && (
        <li className="flex flex-col items-center gap-2 rounded-2xl bg-muted px-4 py-8 text-center text-[14px] text-muted-foreground">
          <Sparkles className="size-5" /> No agent runs on this ticket yet.
        </li>
      )}
    </ul>
  );

  return (
    <aside className="min-h-0 overflow-y-auto border-t px-5 py-5 lg:col-span-2 xl:col-span-1 xl:border-t-0 xl:border-l">
      <DetailTabs
        tabs={[
          { label: "Profile details", content: profile },
          { label: `Agent runs (${thread.runs.length})`, content: runs },
        ]}
      />
    </aside>
  );
}

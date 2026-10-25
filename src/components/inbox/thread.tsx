import Link from "next/link";
import { AlertTriangle, BadgeDollarSign, CheckCircle2, Globe2, Hash, Lock, Mail, ReceiptText } from "lucide-react";
import { AgentOrb } from "@/components/agent-orb";
import { ApproveAllButton } from "@/components/home/client-bits";
import { categoryLabel } from "@/components/status";
import type { TicketState } from "@/lib/inbox";
import type { TicketThread } from "@/lib/queries";
import { formatUsd, timeAgo } from "@/lib/utils";
import { AssignAgent, ReplyComposer, ResolveToggle, ThreadScroll } from "./actions";
import { channelOf, PersonAvatar } from "./parts";

const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function SenderRow({ name, at, avatar, right }: { name: string; at: Date; avatar: React.ReactNode; right?: boolean }) {
  return right ? (
    <div className="flex items-center justify-end gap-2.5">
      <span className="text-[13px] text-muted-foreground">{timeAgo(at)}</span>
      <span className="text-[16px] font-semibold">{name}</span>
      {avatar}
    </div>
  ) : (
    <div className="flex items-center gap-2.5">
      {avatar}
      <span className="text-[16px] font-semibold">{name}</span>
      <span className="text-[13px] text-muted-foreground">{timeAgo(at)}</span>
    </div>
  );
}

function SystemLine({ icon: Icon, children, tone }: { icon: React.ElementType; children: React.ReactNode; tone?: string }) {
  return (
    <div className="flex justify-center">
      <span className="inline-flex max-w-[90%] items-start gap-2 text-[13px] text-muted-foreground">
        <Icon className={`mt-0.5 size-3.5 shrink-0 ${tone ?? ""}`} />
        <span>{children}</span>
      </span>
    </div>
  );
}

/** Middle pane: the ticket as a conversation, with every agent action in order, plus the reply box. */
export function Thread({
  thread,
  state,
  ownerName,
  agents,
}: {
  thread: TicketThread;
  state: TicketState;
  ownerName: string;
  agents: { id: string; name: string; live: boolean }[];
}) {
  const { ticket } = thread;
  const agentOfRun = new Map(thread.runs.map((r) => [r.run.id, r.agentName]));
  const assignee = thread.runs.at(-1)?.agentName ?? null;
  const channel = channelOf(ticket.channel);

  const events: { at: number; key: string; node: React.ReactNode }[] = [];
  const add = (at: Date | null, key: string, node: React.ReactNode) => events.push({ at: (at ?? new Date()).getTime(), key, node });

  for (const s of thread.steps) {
    const agent = agentOfRun.get(s.runId) ?? "Agent";
    const input = (s.input ?? {}) as Record<string, string>;
    if (s.toolName === "update_ticket")
      add(
        s.createdAt,
        s.id,
        <div className="rounded-2xl border border-[#f1e3bd] bg-[#fffaeb] px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold tracking-[0.04em] text-[#8a6100] uppercase">
            <Lock className="size-3.5" /> Internal note · {agent}
            <span className="ml-auto font-medium normal-case tracking-normal text-[#8a6100]/80">
              {[input.urgency && input.urgency.charAt(0).toUpperCase() + input.urgency.slice(1), input.category && categoryLabel(input.category)].filter(Boolean).join(" · ")}
            </span>
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-foreground/90">{input.note}</p>
        </div>,
      );
    else if (s.toolName === "news_search" || s.toolName === "web_search")
      add(
        s.createdAt,
        s.id,
        <SystemLine icon={Globe2}>
          {agent} searched {s.toolName === "news_search" ? "Google News" : "Google"} for &ldquo;{input.query}&rdquo;
        </SystemLine>,
      );
    else if (s.toolName === "post_slack_message")
      add(
        s.createdAt,
        s.id,
        <SystemLine icon={Hash}>
          {agent} alerted <b className="font-semibold text-foreground/80">{input.channel}</b> in Slack
        </SystemLine>,
      );
  }

  const pendingByRun = new Map<string, typeof thread.pending>();
  for (const a of thread.pending) pendingByRun.set(a.runId, [...(pendingByRun.get(a.runId) ?? []), a]);
  for (const [runId, items] of pendingByRun)
    add(
      items[0].createdAt,
      `ap-${runId}`,
      <div className="rounded-2xl border border-warning/25 bg-warning-soft/60 px-4 py-3.5">
        <div className="text-[14px] font-semibold">{agentOfRun.get(runId)} is waiting for your approval</div>
        <ul className="mt-2 space-y-1.5">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-2 text-[14px]">
              {a.action === "issue_refund" ? <BadgeDollarSign className="size-4" /> : <Mail className="size-4" />}
              {a.action === "issue_refund" ? `Refund ${formatUsd(Number(a.args.amount_usd), 2)}${a.args.invoice_id ? ` for ${String(a.args.invoice_id)}` : ""}` : `Email: ${String(a.args.subject ?? "reply to the customer")}`}
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <ApproveAllButton approvalIds={items.map((a) => a.id)} reviewHref={`/runs/${runId}`} />
        </div>
      </div>,
    );

  for (const e of thread.emails) {
    const agent = e.runId ? agentOfRun.get(e.runId) : null;
    add(
      e.createdAt,
      e.id,
      <div className="space-y-2">
        <SenderRow right name={agent ?? ownerName} at={e.createdAt} avatar={agent ? <AgentOrb seed={agent} size={32} /> : <PersonAvatar name={ownerName} size={32} />} />
        <div className="ml-auto max-w-[92%] text-[15px] leading-relaxed">
          <div className="mb-1 flex items-center justify-end gap-1.5 text-[12px] font-medium text-muted-foreground">
            <Mail className="size-3.5" /> {e.subject}
          </div>
          <p className="whitespace-pre-line">{e.body}</p>
        </div>
      </div>,
    );
  }

  for (const r of thread.refunds)
    add(
      r.createdAt,
      r.id,
      <div className="ml-auto w-64 overflow-hidden rounded-2xl border shadow-[0_10px_30px_-14px_rgba(16,24,40,0.35)]">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 bg-white px-4 py-3 text-[11px]">
          <dt className="tracking-[0.04em] text-muted-foreground uppercase">Invoice</dt>
          <dt className="text-right tracking-[0.04em] text-muted-foreground uppercase">Amount</dt>
          <dd className="font-medium">{r.invoiceId || "—"}</dd>
          <dd className="text-right font-semibold tabular-nums">{formatUsd(r.amountUsd, 2)}</dd>
          <dt className="col-span-2 mt-1 tracking-[0.04em] text-muted-foreground uppercase">Date &amp; time</dt>
          <dd className="col-span-2 font-medium">
            {day(r.createdAt)} · {timeAgo(r.createdAt)}
          </dd>
        </dl>
        <div className="flex items-center gap-3 bg-[#3c4867] px-4 py-3 text-white">
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">Refund issued</div>
            <span className="mt-1 inline-block rounded-md bg-white/15 px-1.5 py-0.5 text-[11px] font-medium tabular-nums">#RF-{r.id.slice(0, 5).toUpperCase()}</span>
          </div>
          {r.runId && (
            <Link href={`/runs/${r.runId}`} aria-label="Open the run that issued this refund" className="flex size-8 items-center justify-center rounded-lg border border-white/30 hover:bg-white/10">
              <ReceiptText className="size-4" />
            </Link>
          )}
        </div>
      </div>,
    );

  for (const { run, agentName } of thread.runs)
    if (run.endedAt && run.summary)
      add(
        run.endedAt,
        `end-${run.id}`,
        <SystemLine icon={run.outcome === "handled" ? CheckCircle2 : AlertTriangle} tone={run.outcome === "handled" ? "text-success" : "text-warning"}>
          {agentName} {run.outcome === "handled" ? "marked this handled" : run.outcome === "flagged" ? "handed this to your team" : "stopped"}: {run.summary}{" "}
          <Link href={`/runs/${run.id}`} className="font-semibold text-foreground/80 underline-offset-2 hover:underline">
            Timeline
          </Link>
        </SystemLine>,
      );

  events.sort((a, b) => a.at - b.at);

  return (
    <section className="flex min-h-0 min-w-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3.5 sm:px-6">
        <PersonAvatar name={ticket.customerName} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-[17px] font-semibold">{ticket.customerName}</span>
            <span className="shrink-0 text-[13px] text-muted-foreground">{timeAgo(ticket.receivedAt)}</span>
          </div>
          <div className="truncate text-[13px] text-muted-foreground">
            {ticket.company} · {channel.label} · <span className="tabular-nums">{ticket.id}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AssignAgent ticketId={ticket.id} current={assignee} agents={agents} />
          <ResolveToggle ticketId={ticket.id} resolved={ticket.status === "resolved"} />
        </div>
      </header>

      <ThreadScroll watch={`${ticket.id}:${events.length}`} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          {day(ticket.receivedAt)}
          <span className="h-px flex-1 bg-border" />
        </div>
        <div className="space-y-2">
          <SenderRow name={ticket.customerName} at={ticket.receivedAt} avatar={<PersonAvatar name={ticket.customerName} size={32} />} />
          <div className="ml-[42px] max-w-[85%] rounded-2xl rounded-tl-md border border-black/[0.05] bg-muted px-4 py-3 text-[15px] leading-relaxed">
            <div className="mb-1 font-semibold">{ticket.subject}</div>
            {ticket.body}
          </div>
        </div>
        {events.map((e) => (
          <div key={e.key}>{e.node}</div>
        ))}
        {state === "new" && <SystemLine icon={Globe2}>No agent has picked this up yet. Hand it to one above, or reply yourself.</SystemLine>}
      </ThreadScroll>

      <ReplyComposer ticketId={ticket.id} to={ticket.customerEmail} ownerName={ownerName} />
    </section>
  );
}


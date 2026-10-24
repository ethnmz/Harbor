"use client";

import { useState } from "react";
import {
  AlertOctagon,
  BadgeDollarSign,
  Braces,
  CheckCircle2,
  Globe2,
  Hand,
  Mail,
  MessageSquare,
  Newspaper,
  ShieldAlert,
  Sparkles,
  Tag,
  UserRound,
  XCircle,
} from "lucide-react";
import { ApprovalActions } from "@/components/approval-actions";
import { SlackPreview } from "@/components/slack-preview";
import { categoryLabel, UrgencyBadge } from "@/components/status";
import { Badge } from "@/components/ui/primitives";
import type { Jsonified } from "@/lib/json";
import type { RunDetail } from "@/lib/queries";
import { cn, formatMs, formatUsd } from "@/lib/utils";

export type StepJson = Jsonified<RunDetail["steps"][number]>;
export type ApprovalJson = Jsonified<RunDetail["approvals"][number]>;

type Obj = Record<string, unknown>;
const o = (v: unknown) => (v && typeof v === "object" ? (v as Obj) : {});

const TOOL_META: Record<string, { icon: React.ElementType; label: string }> = {
  news_search: { icon: Newspaper, label: "News search" },
  web_search: { icon: Globe2, label: "Web search" },
  post_slack_message: { icon: MessageSquare, label: "Post to Slack" },
  update_ticket: { icon: Tag, label: "Update ticket" },
  lookup_customer: { icon: UserRound, label: "Look up customer" },
  issue_refund: { icon: BadgeDollarSign, label: "Issue refund" },
  email_customer: { icon: Mail, label: "Email customer" },
};

function modelLabel(id: string) {
  return id
    .replace("claude-", "Claude ")
    .replace(/-(\d+)-(\d+)$/, " $1.$2")
    .replace(/\b(opus|sonnet|haiku)\b/i, (m) => m[0].toUpperCase() + m.slice(1));
}

export function StepView({ step, approval, onDecided }: { step: StepJson; approval?: ApprovalJson; onDecided?: () => void }) {
  const [raw, setRaw] = useState(false);
  const input = o(step.input);
  const output = o(step.output);

  let icon: React.ElementType = Sparkles;
  let title: React.ReactNode = "";
  let tone: "default" | "success" | "warning" | "danger" | "primary" = "default";
  let body: React.ReactNode = null;
  const meta: string[] = [];

  if (step.type === "llm") {
    icon = Sparkles;
    tone = "primary";
    const simulated = input.provider === "simulated";
    title = (
      <>
        {simulated ? "Harbor simulator" : modelLabel(String(input.model))}
        <span className="font-normal text-muted-foreground"> decided</span>
      </>
    );
    const calls = (output.tool_calls as string[]) ?? [];
    body = (
      <div className="space-y-2">
        {output.text ? <p className="text-[13px] leading-relaxed text-foreground/90">{String(output.text)}</p> : null}
        {calls.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            Next:
            {calls.map((c, i) => (
              <code key={i} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                {c}
              </code>
            ))}
          </div>
        )}
        {output.fallback ? <p className="text-xs text-warning">{String(output.fallback)}</p> : null}
      </div>
    );
    meta.push(`${step.inputTokens.toLocaleString()} in / ${step.outputTokens.toLocaleString()} out tokens`, formatUsd(step.cost));
    if (simulated) meta.push("simulated");
  } else if (step.type === "tool") {
    const m = TOOL_META[step.toolName ?? ""] ?? { icon: Braces, label: step.toolName };
    icon = m.icon;
    tone = step.status === "ok" ? "default" : "danger";
    title = (
      <>
        {m.label} <code className="ml-1 font-mono text-[11px] font-normal text-muted-foreground">{step.toolName}</code>
      </>
    );
    body = <ToolBody name={step.toolName ?? ""} input={input} output={output} ok={step.status === "ok"} />;
    if (step.cost) meta.push(formatUsd(step.cost, 3));
    if (output.approved_by) meta.push(`approved by ${String(output.approved_by)}`);
  } else if (step.type === "approval") {
    icon = Hand;
    const status = approval?.status ?? step.status;
    tone = status === "approved" ? "success" : status === "rejected" ? "danger" : "warning";
    title = status === "pending" ? "Waiting for manager approval" : status === "approved" ? "Approved by a manager" : "Rejected by a manager";
    body = (
      <div className="space-y-3">
        <ActionSummary name={step.toolName ?? ""} input={input} />
        {status === "pending" && approval ? (
          <ApprovalActions approvalId={approval.id} onDecided={onDecided} />
        ) : (
          <p className="text-xs text-muted-foreground" suppressHydrationWarning>
            {approval?.decidedBy ?? String(output.decided_by ?? "")} {status} this
            {approval?.decidedAt ? ` at ${new Date(approval.decidedAt).toLocaleTimeString()}` : ""}
            {approval?.note ? `: "${approval.note}"` : ""}.
          </p>
        )}
      </div>
    );
  } else if (step.type === "guardrail") {
    icon = ShieldAlert;
    tone = "warning";
    title = (
      <>
        Blocked by guardrail <code className="ml-1 font-mono text-[11px] font-normal text-muted-foreground">{String(output.rule)}</code>
      </>
    );
    body = <p className="text-[13px] text-foreground/90">{String(output.message)}</p>;
  } else if (step.type === "final") {
    const flagged = output.outcome === "flagged";
    icon = flagged ? AlertOctagon : CheckCircle2;
    tone = flagged ? "warning" : "success";
    title = flagged ? "Finished: flagged for a human" : "Finished: handled";
    body = <p className="text-[13px] leading-relaxed">{String(output.summary)}</p>;
  } else if (step.type === "error") {
    icon = XCircle;
    tone = "danger";
    title = "Run failed";
    body = <p className="text-[13px] text-danger">{String(output.message)}</p>;
  }

  const Icon = icon;
  return (
    <li className="relative flex gap-3 pb-5 animate-rise">
      <div
        className={cn(
          "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border bg-card [&_svg]:size-3.5",
          tone === "primary" && "border-primary/25 bg-primary-soft text-primary",
          tone === "success" && "border-success/25 bg-success-soft text-success",
          tone === "warning" && "border-warning/25 bg-warning-soft text-warning",
          tone === "danger" && "border-danger/25 bg-danger-soft text-danger",
        )}
      >
        <Icon />
      </div>
      <div className="min-w-0 flex-1 rounded-lg border bg-card px-3.5 py-2.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13px] font-medium">{title}</span>
          <span className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
            {meta.map((m) => (
              <span key={m}>{m}</span>
            ))}
            {step.latencyMs > 0 && <span>{formatMs(step.latencyMs)}</span>}
            <span className="font-mono">#{step.seq}</span>
            <button type="button" onClick={() => setRaw(!raw)} className="cursor-pointer rounded px-1 hover:bg-muted hover:text-foreground" title="Raw log row">
              <Braces className="size-3" />
            </button>
          </span>
        </div>
        {body && <div className="mt-2">{body}</div>}
        {raw && (
          <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-[#0b0f14] p-3 font-mono text-[11px] leading-5 text-[#cbd5e1]">
            {JSON.stringify({ table: "run_steps", ...step }, null, 2)}
          </pre>
        )}
      </div>
    </li>
  );
}

export function ActionSummary({ name, input }: { name: string; input: Obj }) {
  if (name === "issue_refund")
    return (
      <div className="flex flex-wrap items-baseline gap-2 rounded-md border border-warning/20 bg-warning-soft/50 px-3 py-2">
        <span className="text-lg font-semibold tabular-nums">{formatUsd(Number(input.amount_usd), 2)}</span>
        <span className="text-[13px]">refund{input.invoice_id ? ` for ${String(input.invoice_id)}` : ""}</span>
        <span className="w-full text-xs text-muted-foreground">{String(input.reason ?? "")}</span>
      </div>
    );
  if (name === "email_customer") return <EmailPreview subject={String(input.subject)} body={String(input.body)} />;
  return <KeyValues data={input} />;
}

function EmailPreview({ to, subject, body }: { to?: string; subject: string; body: string }) {
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="border-b bg-muted/40 px-3 py-1.5 text-xs">
        {to && <div className="text-muted-foreground">To: {to}</div>}
        <div className="font-medium">{subject}</div>
      </div>
      <p className="whitespace-pre-wrap px-3 py-2 text-[13px] leading-relaxed">{body}</p>
    </div>
  );
}

function KeyValues({ data }: { data: Obj }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-mono text-muted-foreground">{k}</dt>
          <dd className="truncate">{typeof v === "string" ? v : JSON.stringify(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ToolBody({ name, input, output, ok }: { name: string; input: Obj; output: Obj; ok: boolean }) {
  if (!ok) return <p className="text-[13px] text-danger">{String(output.error ?? "Tool call failed")}</p>;

  if (name === "news_search" || name === "web_search") {
    const results = (output.results as { title: string; link: string; source: string | null; date: string | null; snippet: string | null }[]) ?? [];
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Badge variant="primary">SerpApi · {String(output.engine)}</Badge>
          <span className="font-mono text-muted-foreground">&ldquo;{String(output.query)}&rdquo;</span>
          {output.simulated ? <Badge variant="outline">Simulated</Badge> : output.cached ? <Badge variant="outline">Cached</Badge> : <Badge variant="success">Live</Badge>}
          <span className="text-muted-foreground">{results.length} results</span>
        </div>
        <ol className="space-y-1.5">
          {results.slice(0, 4).map((r, i) => (
            <li key={i} className="rounded-md border px-2.5 py-1.5">
              <a href={r.link} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-primary hover:underline">
                {r.title}
              </a>
              <div className="flex gap-2 text-[11px] text-muted-foreground">
                {r.source && <span className="truncate">{r.source}</span>}
                {r.date && <span className="shrink-0">· {r.date}</span>}
              </div>
              {r.snippet && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.snippet}</p>}
            </li>
          ))}
        </ol>
      </div>
    );
  }
  if (name === "post_slack_message")
    return <SlackPreview channel={String(output.channel ?? input.channel)} text={String(input.text)} delivered={Boolean(output.delivered_to_slack)} note={output.note as string | undefined} />;
  if (name === "update_ticket")
    return (
      <div className="flex flex-wrap items-center gap-2">
        <UrgencyBadge urgency={String(input.urgency)} />
        <Badge variant="outline">{categoryLabel(String(input.category))}</Badge>
        <span className="text-[13px] text-foreground/90">{String(input.note)}</span>
      </div>
    );
  if (name === "lookup_customer") {
    const invoices = (output.invoices as { id: string; amountUsd: number; date: string; status: string }[]) ?? [];
    return (
      <div className="space-y-1.5 text-xs">
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-muted-foreground">
          <span>
            <span className="text-foreground">{String(output.company)}</span> · {String(output.plan)} plan
          </span>
          <span>${String(output.mrrUsd)}/mo</span>
          <span>since {String(output.customerSince)}</span>
        </div>
        <table className="w-full">
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-t">
                <td className="py-1 font-mono">{inv.id}</td>
                <td>{inv.date}</td>
                <td className="tabular-nums">{formatUsd(inv.amountUsd, 2)}</td>
                <td className={cn(inv.status.includes("duplicate") && "font-medium text-warning")}>{inv.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (name === "issue_refund")
    return (
      <div className="text-[13px]">
        <span className="font-semibold tabular-nums">{formatUsd(Number(output.amount_usd), 2)}</span> refund submitted
        {output.invoice_id ? ` for ${String(output.invoice_id)}` : ""} · arrives in {String(output.eta)}
      </div>
    );
  if (name === "email_customer") return <EmailPreview to={String(output.to)} subject={String(input.subject)} body={String(input.body)} />;
  return <KeyValues data={output} />;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Database, Loader2 } from "lucide-react";
import { RunBadge, UrgencyBadge } from "@/components/status";
import { Card } from "@/components/ui/primitives";
import type { Jsonified } from "@/lib/json";
import type { RunDetail } from "@/lib/queries";
import { formatMs, formatUsd } from "@/lib/utils";
import { StepView } from "./step-views";

type Detail = Jsonified<RunDetail>;

const ACTIVE = ["queued", "running"];

export function RunTimeline({ initial }: { initial: Detail }) {
  const [d, setD] = useState(initial);
  const kicked = useRef(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/runs/${initial.run.id}`, { cache: "no-store" });
    if (res.ok) setD(await res.json());
  }, [initial.run.id]);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const created = new Date(d.run.createdAt).getTime();
    if (d.run.status === "queued" && !kicked.current && Date.now() - created > 8000) {
      kicked.current = true;
      void fetch(`/api/runs/${d.run.id}/execute`, { method: "POST" });
    }
    if (ACTIVE.includes(d.run.status) || d.run.status === "awaiting_approval") {
      timer = setTimeout(
        () => {
          if (!stop) void refresh();
        },
        ACTIVE.includes(d.run.status) ? 900 : 3000,
      );
    }
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [d, refresh]);

  const { run, ticket, agent, steps } = d;
  const duration = run.startedAt ? (run.endedAt ? new Date(run.endedAt).getTime() : Date.now()) - new Date(run.startedAt).getTime() : 0;
  const searches = steps.filter((s) => s.type === "tool" && (s.toolName === "news_search" || s.toolName === "web_search")).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        {run.summary && run.status !== "running" && (
          <Card className="mb-5 px-4 py-3">
            <div className="text-xs font-medium text-muted-foreground">Outcome</div>
            <p className="mt-0.5 text-sm">{run.summary}</p>
          </Card>
        )}
        <ol className="relative before:absolute before:top-2 before:bottom-6 before:left-3.5 before:w-px before:bg-border">
          {steps.map((s) => (
            <StepView key={s.id} step={s} approval={d.approvals.find((a) => a.stepId === s.id)} onDecided={() => void refresh()} />
          ))}
          {ACTIVE.includes(run.status) && (
            <li className="relative flex items-center gap-3 pb-2">
              <div className="relative z-10 flex size-7 items-center justify-center rounded-full border bg-card">
                <Loader2 className="size-3.5 animate-spin text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">{run.status === "queued" ? "Queued…" : "Working…"}</span>
            </li>
          )}
          {!steps.length && !ACTIVE.includes(run.status) && <li className="text-sm text-muted-foreground">No steps recorded.</li>}
        </ol>
      </div>

      <aside className="space-y-4">
        {ticket && (
          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">{ticket.id}</span>
              <UrgencyBadge urgency={ticket.urgency} />
            </div>
            <div className="text-sm font-medium">{ticket.subject}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {ticket.customerName} · {ticket.company} · {ticket.customer.plan}
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-foreground/85">{ticket.body}</p>
          </Card>
        )}
        <Card className="p-4">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs">
            <Fact label="Status">
              <RunBadge status={run.status} outcome={run.outcome} />
            </Fact>
            <Fact label="Agent">
              <Link href={`/agents/${agent.id}`} className="font-medium text-primary hover:underline">
                {agent.name}
              </Link>
            </Fact>
            <Fact label="Trigger">{run.trigger === "test" ? "Test run" : run.trigger === "live" ? "Live inbox" : "Manual"}</Fact>
            <Fact label="Model">{run.provider === "simulated" ? "Simulator" : run.model}</Fact>
            <Fact label="Duration">{duration ? formatMs(duration) : "—"}</Fact>
            <Fact label="Est. cost">{formatUsd(run.costEstimate)}</Fact>
            <Fact label="Tokens">{(run.inputTokens + run.outputTokens).toLocaleString()}</Fact>
            <Fact label="Tool calls">
              {run.toolCalls}
              {searches ? ` (${searches} SerpApi)` : ""}
            </Fact>
          </dl>
        </Card>
        <div className="flex gap-2.5 rounded-lg border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
          <Database className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span>
            Every step above is a row in <code className="font-mono">run_steps</code>, with inputs, outputs, latency and cost, plus approvals and an
            append-only audit log, stored in Tiger Postgres. Click <code className="font-mono">{"{ }"}</code> on any step to see the raw row.
          </span>
        </div>
      </aside>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-medium">{children}</dd>
    </div>
  );
}

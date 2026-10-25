"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Globe2 } from "lucide-react";
import { RunBadge, UrgencyBadge } from "@/components/status";
import { Card } from "@/components/ui/primitives";
import type { BatchRow } from "@/lib/queries";
import { cn, formatMs, formatUsd } from "@/lib/utils";

const ACTIVE = ["queued", "running"];

const TOOL_VERB: Record<string, string> = {
  news_search: "Searching the news via SerpApi…",
  web_search: "Searching the web via SerpApi…",
  update_ticket: "Updating the ticket…",
  lookup_customer: "Looking up the customer…",
  post_slack_message: "Posting to Slack…",
  issue_refund: "Preparing a refund…",
  email_customer: "Drafting an email…",
};

function currentActivity(r: BatchRow) {
  if (r.status === "queued") return "Waiting to start";
  if (!r.current) return "Reading the ticket…";
  if (r.current.type === "llm") return "Thinking…";
  return TOOL_VERB[r.current.toolName ?? ""] ?? "Working…";
}

export function useBatch(batchId: string | null) {
  const [rows, setRows] = useState<BatchRow[]>([]);
  const kicked = useRef(false);
  const started = useRef(Date.now());
  useEffect(() => {
    if (!batchId) return;
    started.current = Date.now();
    kicked.current = false;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch(`/api/batches/${batchId}`, { cache: "no-store" });
        const data = (await res.json()) as { runs: BatchRow[] };
        if (stop) return;
        setRows(data.runs);
        const active = data.runs.some((r) => ACTIVE.includes(r.status));
        const waiting = data.runs.some((r) => r.status === "awaiting_approval");
        // Safety net in case background execution never started.
        if (!kicked.current && Date.now() - started.current > 10_000) {
          kicked.current = true;
          for (const r of data.runs) if (r.status === "queued") void fetch(`/api/runs/${r.id}/execute`, { method: "POST" });
        }
        if (active) timer = setTimeout(tick, 1000);
        else if (waiting) timer = setTimeout(tick, 4000);
      } catch {
        if (!stop) timer = setTimeout(tick, 2000);
      }
    };
    void tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [batchId]);
  return rows;
}

export function summarize(rows: BatchRow[]) {
  const done = rows.filter((r) => !ACTIVE.includes(r.status));
  const durations = done.filter((r) => r.startedAt && r.endedAt).map((r) => new Date(r.endedAt!).getTime() - new Date(r.startedAt!).getTime());
  return {
    total: rows.length,
    done: done.length,
    handled: rows.filter((r) => r.status === "completed" && r.outcome === "handled").length,
    flagged: rows.filter((r) => r.status === "completed" && r.outcome === "flagged").length,
    waiting: rows.filter((r) => r.status === "awaiting_approval").length,
    failed: rows.filter((r) => r.status === "failed").length,
    searches: rows.reduce((a, r) => a + r.searches, 0),
    cost: rows.reduce((a, r) => a + r.cost, 0),
    avgMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
    finished: rows.length > 0 && done.length === rows.length,
  };
}

export function TestReport({ rows }: { rows: BatchRow[] }) {
  const s = summarize(rows);
  return (
    <Card className="overflow-hidden">
      <div className="border-b px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <div className="text-[15px] font-semibold tracking-tight">{s.finished ? "Test run complete" : "Running on 10 sample tickets…"}</div>
            <div className="text-xs text-muted-foreground">
              {s.done}/{s.total || 10} done{s.avgMs ? ` · avg ${formatMs(s.avgMs)} per ticket` : ""} · est. {formatUsd(s.cost)}
              {s.searches ? ` · ${s.searches} SerpApi searches` : ""}
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-2 text-sm">
            <Counter label="Handled" n={s.handled} tone="success" />
            <Counter label="Flagged" n={s.flagged} tone="warning" />
            <Counter label="Needs approval" n={s.waiting} tone="warning" />
            <Counter label="Failed" n={s.failed} tone="danger" />
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${s.total ? (s.done / s.total) * 100 : 3}%` }} />
        </div>
      </div>
      <ul className="divide-y">
        {(rows.length ? rows : Array.from({ length: 10 }, () => null)).map((r, i) =>
          r ? (
            <li key={r.id} className="group grid grid-cols-[1fr_auto] items-start gap-3 px-5 py-3 animate-rise md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_auto]">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground tabular-nums">{r.ticketId}</span>
                  {r.urgency && <UrgencyBadge urgency={r.urgency} />}
                  {r.searches > 0 && (
                    <span title="Used SerpApi" className="text-primary">
                      <Globe2 className="size-3.5" />
                    </span>
                  )}
                </div>
                <div className="truncate text-sm font-medium">{r.subject}</div>
                <div className="truncate text-xs text-muted-foreground">{r.customer}</div>
              </div>
              <div className={cn("hidden text-[13px] md:block", ACTIVE.includes(r.status) ? "text-muted-foreground" : "text-foreground/90")}>
                {ACTIVE.includes(r.status) ? <span className="animate-pulse">{currentActivity(r)}</span> : r.status === "awaiting_approval" ? "Paused: waiting for a manager to approve a risky action." : r.summary}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <RunBadge status={r.status} outcome={r.outcome} />
                <Link href={`/runs/${r.id}`} className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary">
                  Timeline <ArrowUpRight className="size-3" />
                </Link>
              </div>
            </li>
          ) : (
            <li key={i} className="flex items-center gap-3 px-5 py-4">
              <div className="shimmer h-4 w-1/3 rounded" />
              <div className="shimmer ml-auto h-4 w-16 rounded" />
            </li>
          ),
        )}
      </ul>
    </Card>
  );
}

function Counter({ label, n, tone }: { label: string; n: number; tone: "success" | "warning" | "danger" }) {
  return (
    <div className={cn("rounded-lg border px-2.5 py-1 text-xs", n ? "bg-card" : "bg-muted/40 text-muted-foreground")}>
      <span
        className={cn(
          "mr-1 text-sm font-semibold tabular-nums",
          n && tone === "success" && "text-success",
          n && tone === "warning" && "text-warning",
          n && tone === "danger" && "text-danger",
        )}
      >
        {n}
      </span>
      {label}
    </div>
  );
}

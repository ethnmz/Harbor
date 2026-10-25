import Link from "next/link";
import { Globe2 } from "lucide-react";
import { RunBadge } from "@/components/status";
import { EmptyState } from "@/components/ui/primitives";
import type { recentRuns } from "@/lib/queries";
import { formatUsd, timeAgo } from "@/lib/utils";
import { AgentOrb } from "@/components/agent-orb";

type Row = Awaited<ReturnType<typeof recentRuns>>[number];

export function RunsTable({ rows, showAgent = true, empty }: { rows: Row[]; showAgent?: boolean; empty?: React.ReactNode }) {
  if (!rows.length) return <EmptyState title="No runs yet">{empty ?? "Runs appear here as soon as an agent works a ticket."}</EmptyState>;
  const now = Date.now();
  return (
    <div className="overflow-hidden rounded-2xl border">
      <table className="w-full text-[14px]">
        <thead className="border-b bg-muted text-left text-[12px] tracking-[0.04em] text-muted-foreground uppercase">
          <tr>
            <th className="px-4 py-3 font-semibold">Ticket</th>
            {showAgent && <th className="hidden px-4 py-3 font-semibold md:table-cell">Agent</th>}
            <th className="hidden px-4 py-3 font-semibold lg:table-cell">Summary</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="hidden px-4 py-3 text-right font-semibold sm:table-cell">Cost</th>
            <th className="px-4 py-3 text-right font-semibold">When</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(({ run, ticket, agentName }) => (
            <tr key={run.id} className="group hover:bg-muted/50">
              <td className="max-w-64 px-4 py-3">
                <Link href={`/runs/${run.id}`} className="block">
                  <span className="text-[12px] text-muted-foreground tabular-nums">{ticket?.id}</span>
                  <span className="block truncate font-semibold">{ticket?.subject ?? "—"}</span>
                </Link>
              </td>
              {showAgent && (
                <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                  <span className="flex items-center gap-2">
                    <AgentOrb seed={agentName} size={12} />
                    {agentName}
                  </span>
                </td>
              )}
              <td className="hidden max-w-80 px-4 py-3 text-[13px] text-muted-foreground lg:table-cell">
                <span className="line-clamp-2">{run.summary ?? (run.status === "awaiting_approval" ? "Waiting for approval" : "…")}</span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <RunBadge status={run.status} outcome={run.outcome} />
                  {run.trigger === "test" && <span className="text-[11px] text-muted-foreground">test</span>}
                </div>
              </td>
              <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">{formatUsd(run.costEstimate)}</td>
              <td className="px-4 py-3 text-right text-[13px] whitespace-nowrap text-muted-foreground">{timeAgo(run.createdAt, now)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SerpIcon() {
  return <Globe2 className="size-3.5 text-primary" />;
}

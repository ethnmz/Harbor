import Link from "next/link";
import { Globe2 } from "lucide-react";
import { RunBadge } from "@/components/status";
import { Card, EmptyState } from "@/components/ui/primitives";
import type { recentRuns } from "@/lib/queries";
import { formatUsd, timeAgo } from "@/lib/utils";

type Row = Awaited<ReturnType<typeof recentRuns>>[number];

export function RunsTable({ rows, showAgent = true, empty }: { rows: Row[]; showAgent?: boolean; empty?: React.ReactNode }) {
  if (!rows.length) return <EmptyState title="No runs yet">{empty ?? "Runs appear here as soon as an agent works a ticket."}</EmptyState>;
  const now = Date.now();
  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Ticket</th>
            {showAgent && <th className="hidden px-4 py-2 font-medium md:table-cell">Agent</th>}
            <th className="hidden px-4 py-2 font-medium lg:table-cell">Summary</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">Cost</th>
            <th className="px-4 py-2 text-right font-medium">When</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(({ run, ticket, agentName }) => (
            <tr key={run.id} className="group hover:bg-muted/30">
              <td className="max-w-64 px-4 py-2.5">
                <Link href={`/runs/${run.id}`} className="block">
                  <span className="font-mono text-[11px] text-muted-foreground">{ticket?.id}</span>
                  <span className="block truncate font-medium group-hover:text-primary">{ticket?.subject ?? "—"}</span>
                </Link>
              </td>
              {showAgent && <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">{agentName}</td>}
              <td className="hidden max-w-80 px-4 py-2.5 text-[13px] text-muted-foreground lg:table-cell">
                <span className="line-clamp-2">{run.summary ?? (run.status === "awaiting_approval" ? "Waiting for approval" : "…")}</span>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1.5">
                  <RunBadge status={run.status} outcome={run.outcome} />
                  {run.trigger === "test" && <span className="text-[11px] text-muted-foreground">test</span>}
                </div>
              </td>
              <td className="hidden px-4 py-2.5 text-right tabular-nums text-muted-foreground sm:table-cell">{formatUsd(run.costEstimate)}</td>
              <td className="px-4 py-2.5 text-right text-xs whitespace-nowrap text-muted-foreground">{timeAgo(run.createdAt, now)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function SerpIcon() {
  return <Globe2 className="size-3.5 text-primary" />;
}

import { Database } from "lucide-react";
import { AuditList } from "@/components/audit-list";
import { Panel } from "@/components/ui/primitives";
import { hasTimescale, recentAudit } from "@/lib/queries";

export default async function ActivityPage() {
  const [entries, ts] = await Promise.all([recentAudit(200), hasTimescale()]);
  return (
    <Panel title="Activity log" description="Append-only record of every human and agent action: configs, deployments, runs, tool calls and approval decisions.">
      <div className="mb-5 flex items-start gap-3 rounded-2xl bg-muted px-4 py-3.5 text-[13px] text-muted-foreground">
        <Database className="mt-0.5 size-4 shrink-0 text-foreground" />
        {ts ? (
          <span>
            Stored in a TimescaleDB hypertable on Tiger Cloud (<code className="font-mono">audit_log</code>), partitioned by time, compressed after 30 days and retained
            for 400 days by policy.
          </span>
        ) : (
          <span>
            Stored in Postgres (<code className="font-mono">audit_log</code>). On Tiger Cloud, <code className="font-mono">npm run db:setup</code> turns it into a TimescaleDB
            hypertable with compression and a 400-day retention policy.
          </span>
        )}
      </div>
      <div className="overflow-hidden rounded-2xl border">
        <AuditList entries={entries} />
      </div>
    </Panel>
  );
}

import { AuditList } from "@/components/audit-list";
import { Panel } from "@/components/ui/primitives";
import { hasTimescale, recentAudit } from "@/lib/queries";

export default async function ActivityPage() {
  const [entries, ts] = await Promise.all([recentAudit(200), hasTimescale()]);
  return (
    <Panel title="Activity log" description={`Every action by people and agents, in order. Stored in ${ts ? "a TimescaleDB hypertable on Tiger Cloud" : "Postgres"} and never edited.`}>
      <div className="overflow-hidden rounded-2xl border">
        <AuditList entries={entries} />
      </div>
    </Panel>
  );
}

import Link from "next/link";
import { ApprovalsBoard, type ApprovalGroup } from "@/components/approvals-board";
import { Badge, Panel } from "@/components/ui/primitives";
import { toJson } from "@/lib/json";
import { listApprovals } from "@/lib/queries";
import { timeAgo } from "@/lib/utils";

export default async function ApprovalsPage() {
  const rows = await listApprovals();
  const pending = toJson(rows.filter((r) => r.approval.status === "pending"));
  const groups: ApprovalGroup[] = [];
  for (const r of pending) {
    let g = groups.find((x) => x.runId === r.approval.runId);
    if (!g) groups.push((g = { runId: r.approval.runId, agentName: r.agentName, ticket: r.ticket, items: [] }));
    g.items.unshift(r); // rows are newest-first; show actions in the order the agent asked
  }
  const history = rows.filter((r) => r.approval.status !== "pending");
  const now = Date.now();

  return (
    <div className="space-y-6">
      <Panel
        title="Waiting on you"
        description="Agents pause here before risky actions, like refunds or customer emails, until you decide. Requests are also posted to Slack."
      >
        <ApprovalsBoard groups={groups} />
      </Panel>

      <Panel title="Decision history">
      {history.length ? (
        <div className="overflow-hidden rounded-2xl border">
          <table className="w-full text-[14px]">
            <thead className="border-b bg-muted text-left text-[12px] tracking-[0.04em] text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Agent · ticket</th>
                <th className="px-4 py-3 font-semibold">Decision</th>
                <th className="hidden px-4 py-3 font-semibold md:table-cell">By</th>
                <th className="px-4 py-3 text-right font-semibold">When</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {history.map(({ approval, agentName, ticket }) => (
                <tr key={approval.id}>
                  <td className="px-4 py-3">
                    <code className="font-mono text-xs">{approval.action}</code>
                    {approval.action === "issue_refund" && <span className="ml-2 tabular-nums">${Number(approval.args.amount_usd).toFixed(2)}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {agentName} ·{" "}
                    <Link href={`/runs/${approval.runId}`} className="font-medium text-foreground tabular-nums underline-offset-4 hover:underline">
                      {ticket?.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={approval.status === "approved" ? "success" : "danger"} className="capitalize">
                      {approval.status}
                    </Badge>
                    {approval.note && <span className="ml-2 text-xs text-muted-foreground">&ldquo;{approval.note}&rdquo;</span>}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{approval.decidedBy}</td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">{timeAgo(approval.decidedAt, now)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-2xl bg-muted px-5 py-8 text-center text-[14px] text-muted-foreground">No decisions yet.</p>
      )}
      </Panel>
    </div>
  );
}

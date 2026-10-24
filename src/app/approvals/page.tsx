import Link from "next/link";
import { ApprovalsBoard, type ApprovalGroup } from "@/components/approvals-board";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { toJson } from "@/lib/json";
import { listApprovals } from "@/lib/queries";
import { getWorkspace } from "@/lib/seed";
import { timeAgo } from "@/lib/utils";

export default async function ApprovalsPage() {
  const [rows, ws] = await Promise.all([listApprovals(), getWorkspace()]);
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
    <>
      <PageHeader
        title="Approvals"
        description={
          <>
            Agents pause before risky actions. Your workspace policy requires a manager for{" "}
            {ws.policies.approvalRequiredTools.map((t, i) => (
              <span key={t}>
                {i > 0 && " and "}
                <code className="font-mono text-[13px]">{t}</code>
              </span>
            ))}
            . Requests are also posted to Slack.
          </>
        }
      />
      <ApprovalsBoard groups={groups} />

      <h2 className="mt-10 mb-3 text-[15px] font-semibold tracking-tight">Decision history</h2>
      {history.length ? (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">Agent · ticket</th>
                <th className="px-4 py-2 font-medium">Decision</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">By</th>
                <th className="px-4 py-2 text-right font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {history.map(({ approval, agentName, ticket }) => (
                <tr key={approval.id}>
                  <td className="px-4 py-2.5">
                    <code className="font-mono text-xs">{approval.action}</code>
                    {approval.action === "issue_refund" && <span className="ml-2 tabular-nums">${Number(approval.args.amount_usd).toFixed(2)}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {agentName} ·{" "}
                    <Link href={`/runs/${approval.runId}`} className="font-mono text-xs hover:text-primary">
                      {ticket?.id}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={approval.status === "approved" ? "success" : "danger"} className="capitalize">
                      {approval.status}
                    </Badge>
                    {approval.note && <span className="ml-2 text-xs text-muted-foreground">&ldquo;{approval.note}&rdquo;</span>}
                  </td>
                  <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">{approval.decidedBy}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{timeAgo(approval.decidedAt, now)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">No decisions yet.</p>
      )}
    </>
  );
}

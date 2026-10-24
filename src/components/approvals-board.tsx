"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CheckCheck, CheckCircle2, Hand, Loader2, XCircle } from "lucide-react";
import { ApprovalActions } from "@/components/approval-actions";
import { ActionSummary } from "@/components/run/step-views";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import type { Jsonified } from "@/lib/json";
import type { listApprovals } from "@/lib/queries";
import { timeAgo } from "@/lib/utils";

type Row = Jsonified<Awaited<ReturnType<typeof listApprovals>>[number]>;
export type ApprovalGroup = { runId: string; agentName: string; ticket: Row["ticket"]; items: Row[] };

const ACTION_LABEL: Record<string, string> = { issue_refund: "Issue a refund", email_customer: "Email the customer" };

export function ApprovalsBoard({ groups: incoming }: { groups: ApprovalGroup[] }) {
  const router = useRouter();
  // Keep decided groups on screen (with their result) after the server list drops them.
  const [groups, setGroups] = useState(incoming);
  const [decided, setDecided] = useState<Record<string, "approved" | "rejected">>({});
  const [bulk, setBulk] = useState<string | null>(null);

  useEffect(() => {
    setGroups((prev) => [...incoming.filter((g) => !prev.some((p) => p.runId === g.runId)), ...prev]);
  }, [incoming]);

  const markDone = (approvalId: string, d: "approved" | "rejected") => setDecided((m) => ({ ...m, [approvalId]: d }));

  async function approveAll(g: ApprovalGroup) {
    setBulk(g.runId);
    for (const a of g.items.filter((i) => !decided[i.approval.id])) {
      const res = await fetch(`/api/approvals/${a.approval.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision: "approved" }) });
      if (res.ok) markDone(a.approval.id, "approved");
    }
    setBulk(null);
    router.refresh();
  }

  if (!groups.length)
    return (
      <EmptyState icon={<Hand />} title="Nothing waiting for you">
        When an agent wants to do something risky, like issuing a refund or emailing a customer, it pauses here until you decide.
      </EmptyState>
    );

  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const remaining = g.items.filter((i) => !decided[i.approval.id]);
        const allDone = remaining.length === 0;
        const anyRejected = g.items.some((i) => decided[i.approval.id] === "rejected");
        return (
          <Card key={g.runId} className={allDone ? "border-success/30" : "border-warning/30"}>
            <div className="flex flex-wrap items-start gap-3 border-b px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{g.agentName}</span> wants to act on
                  <span className="font-mono">{g.ticket?.id}</span>
                  <span>· {timeAgo(g.items[0].approval.createdAt)}</span>
                </div>
                <div className="mt-0.5 font-medium">{g.ticket?.subject}</div>
                <div className="text-xs text-muted-foreground">
                  {g.ticket?.customerName} · {g.ticket?.customerEmail}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/runs/${g.runId}`}>
                    Run timeline <ArrowUpRight />
                  </Link>
                </Button>
                {remaining.length > 1 && (
                  <Button size="sm" variant="success" disabled={!!bulk} onClick={() => approveAll(g)}>
                    {bulk === g.runId ? <Loader2 className="animate-spin" /> : <CheckCheck />} Approve all ({remaining.length})
                  </Button>
                )}
              </div>
            </div>
            <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
              {g.items.map((a) => {
                const d = decided[a.approval.id];
                return (
                  <div key={a.approval.id} className="space-y-2.5">
                    <div className="flex items-center gap-2 text-[13px] font-medium">
                      {ACTION_LABEL[a.approval.action] ?? a.approval.action}
                      <code className="font-mono text-[11px] font-normal text-muted-foreground">{a.approval.action}</code>
                      {d && <Badge variant={d === "approved" ? "success" : "danger"}>{d === "approved" ? "Approved" : "Rejected"}</Badge>}
                    </div>
                    <ActionSummary name={a.approval.action} input={a.approval.args} />
                    {!d && <ApprovalActions approvalId={a.approval.id} onDecided={(decision) => markDone(a.approval.id, decision)} compact />}
                  </div>
                );
              })}
            </div>
            {allDone && (
              <div className="flex items-center gap-2 border-t bg-success-soft/50 px-5 py-2.5 text-sm">
                {anyRejected ? <XCircle className="size-4 text-danger" /> : <CheckCircle2 className="size-4 text-success" />}
                Decision recorded in the audit log. {g.agentName} resumed the run.
                <Link href={`/runs/${g.runId}`} className="ml-auto font-medium text-primary hover:underline">
                  Watch it finish →
                </Link>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

import { Bot, Inbox } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { categoryLabel, UrgencyBadge } from "@/components/status";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { listTickets } from "@/lib/queries";
import { timeAgo } from "@/lib/utils";

export default async function InboxPage() {
  const rows = await listTickets();
  const now = Date.now();
  const triaged = rows.filter((r) => r.ticket.urgency).length;
  return (
    <>
      <PageHeader
        title="Support inbox"
        description={`Sandbox helpdesk for Tidewell. Sorted by the urgency your agents assigned. ${triaged} of ${rows.length} tickets triaged.`}
      />
      <AutoRefresh />
      {!rows.length ? (
        <EmptyState icon={<Inbox />} title="Inbox is empty" />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y">
            {rows.map(({ ticket: t, agentName }) => (
              <li key={t.id} className="grid gap-2 px-5 py-3.5 md:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_90px]">
                <div className="flex items-start gap-2 md:flex-col md:gap-1">
                  <UrgencyBadge urgency={t.urgency} />
                  {t.inTestSet && <span className="text-[11px] text-muted-foreground">test set</span>}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{t.id}</span>
                    {t.category && <Badge variant="outline">{categoryLabel(t.category)}</Badge>}
                  </div>
                  <div className="truncate text-sm font-medium">{t.subject}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {t.customerName} · {t.company} · {t.customer.plan}
                  </div>
                </div>
                <div className="text-[13px] text-muted-foreground">
                  {t.triageNote ? (
                    <>
                      <span className="line-clamp-2 text-foreground/85">{t.triageNote}</span>
                      {agentName && (
                        <span className="mt-0.5 flex items-center gap-1 text-[11px]">
                          <Bot className="size-3 text-primary" /> {agentName}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="line-clamp-2">{t.body}</span>
                  )}
                </div>
                <div className="text-right text-xs text-muted-foreground">{timeAgo(t.receivedAt, now)}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

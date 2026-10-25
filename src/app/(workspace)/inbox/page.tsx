import { AutoRefresh } from "@/components/auto-refresh";
import { TicketDetails } from "@/components/inbox/details";
import { InboxSidebar, type InboxQuery } from "@/components/inbox/sidebar";
import { Thread } from "@/components/inbox/thread";
import { EmptyState } from "@/components/ui/primitives";
import { INBOX_VIEWS, ticketState } from "@/lib/inbox";
import { inboxTickets, listAgents, ticketThread } from "@/lib/queries";
import { getWorkspace } from "@/lib/seed";

/** Three-pane helpdesk: views and conversations, the ticket as a thread, and the customer. */
export default async function InboxPage({ searchParams }: { searchParams: Promise<{ view?: string; channel?: string; t?: string }> }) {
  const sp = await searchParams;
  const [rows, agents, ws] = await Promise.all([inboxTickets(), listAgents(), getWorkspace()]);
  const withState = rows.map((r) => ({ ...r, state: ticketState(r.ticket.status, r.run) }));
  const view = INBOX_VIEWS.find((v) => v.key === sp.view) ?? INBOX_VIEWS[0];
  const query: InboxQuery = { view: view.key, channel: sp.channel || undefined };
  const visible = withState.filter((r) => view.match(r.state) && (!query.channel || r.ticket.channel === query.channel));
  const selectedId = sp.t && withState.some((r) => r.ticket.id === sp.t) ? sp.t : (visible[0]?.ticket.id ?? null);
  const selected = withState.find((r) => r.ticket.id === selectedId);
  const thread = selectedId ? await ticketThread(selectedId) : null;
  const agentOptions = agents.map(({ agent }) => ({ id: agent.id, name: agent.name, live: agent.status === "live" }));

  return (
    <div className="grid overflow-hidden rounded-[24px] border border-[#eceef1] bg-card shadow-[0_2px_12px_rgba(16,24,40,0.04)] lg:grid-cols-[300px_minmax(0,1fr)] xl:h-[calc(100dvh-140px)] xl:min-h-[620px] xl:grid-cols-[300px_minmax(0,1fr)_340px]">
      <AutoRefresh />
      <InboxSidebar rows={withState} visible={visible} query={{ ...query, t: selectedId ?? undefined }} selected={selectedId} />
      {thread && selected ? (
        <>
          <Thread thread={thread} state={selected.state} ownerName={ws.ownerName} agents={agentOptions} />
          <TicketDetails thread={thread} state={selected.state} />
        </>
      ) : (
        <div className="p-6 xl:col-span-2">
          <EmptyState mascot="murmur" title="No tickets in this view">
            Try another view or channel on the left.
          </EmptyState>
        </div>
      )}
    </div>
  );
}

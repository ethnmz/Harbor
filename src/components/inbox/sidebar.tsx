import Link from "next/link";
import { CheckCircle2, CircleDot, Hand, Inbox, Sparkles } from "lucide-react";
import { INBOX_VIEWS, type InboxView, type TicketState } from "@/lib/inbox";
import type { InboxRow } from "@/lib/queries";
import { cn, timeAgo } from "@/lib/utils";
import { channelOf, PersonAvatar, StateDot } from "./parts";

export type Row = InboxRow & { state: TicketState };
export type InboxQuery = { view: InboxView; channel?: string; t?: string };

export function inboxHref(q: InboxQuery) {
  const p = new URLSearchParams();
  if (q.view !== "all") p.set("view", q.view);
  if (q.channel) p.set("channel", q.channel);
  if (q.t) p.set("t", q.t);
  const s = p.toString();
  return s ? `/inbox?${s}` : "/inbox";
}

const VIEW_ICONS: Record<InboxView, React.ElementType> = { all: Inbox, "needs-you": Hand, "ai-handled": Sparkles, new: CircleDot, resolved: CheckCircle2 };

function Count({ n }: { n: number }) {
  return <span className="text-[13px] text-muted-foreground tabular-nums">{n}</span>;
}

/** Left pane: views, channels and the conversation list, all driven by the URL. */
export function InboxSidebar({ rows, visible, query, selected }: { rows: Row[]; visible: Row[]; query: InboxQuery; selected: string | null }) {
  const channels = [...new Set(rows.map((r) => r.ticket.channel))];
  return (
    <aside className="flex min-h-0 flex-col border-b lg:border-r lg:border-b-0">
      <nav aria-label="Inbox views" className="space-y-0.5 px-4 pt-5">
        {INBOX_VIEWS.map((v) => {
          const Icon = VIEW_ICONS[v.key];
          const active = query.view === v.key;
          return (
            <Link
              key={v.key}
              href={inboxHref({ view: v.key, channel: query.channel })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors",
                active ? "bg-muted font-semibold text-foreground" : "text-foreground/80 hover:bg-muted/60",
              )}
            >
              <Icon className="size-[18px]" strokeWidth={active ? 2.2 : 1.8} />
              <span className="flex-1">{v.label}</span>
              <Count n={rows.filter((r) => v.match(r.state)).length} />
            </Link>
          );
        })}
      </nav>

      <div className="mx-4 my-4 h-px bg-border" />
      <div className="px-4">
        <div className="mb-1.5 px-3 text-[14px] font-semibold">Channels</div>
        {channels.map((key) => {
          const { label, icon: Icon } = channelOf(key);
          const active = query.channel === key;
          return (
            <Link
              key={key}
              href={inboxHref({ view: query.view, channel: active ? undefined : key })}
              aria-current={active ? "true" : undefined}
              className={cn("flex h-9 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors", active ? "bg-muted font-semibold" : "text-foreground/80 hover:bg-muted/60")}
            >
              <Icon className="size-[17px]" strokeWidth={1.9} />
              <span className="flex-1">{label}</span>
              <Count n={rows.filter((r) => r.ticket.channel === key).length} />
            </Link>
          );
        })}
      </div>

      <div className="mx-4 my-4 h-px bg-border" />
      <div className="mb-2 flex items-baseline justify-between px-7">
        <span className="text-[14px] font-semibold">Conversations</span>
        <span className="text-[12px] text-muted-foreground tabular-nums">{visible.length}</span>
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 pb-4 max-lg:max-h-[560px]">
        {visible.map((r) => {
          const on = r.ticket.id === selected;
          return (
            <li key={r.ticket.id}>
              <Link
                href={inboxHref({ ...query, t: r.ticket.id })}
                aria-current={on ? "true" : undefined}
                className={cn("block rounded-2xl border px-3 py-3 transition-colors", on ? "border-black/[0.06] bg-muted" : "border-transparent hover:bg-muted/50")}
              >
                <div className="flex items-center gap-2.5">
                  <PersonAvatar name={r.ticket.customerName} size={30} />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{r.ticket.customerName}</span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground">&ldquo;{r.ticket.subject}&rdquo;</p>
                <div className="mt-1.5 flex items-center justify-between text-[12px] text-muted-foreground">
                  <StateDot state={r.state} />
                  {timeAgo(r.ticket.receivedAt)}
                </div>
              </Link>
            </li>
          );
        })}
        {!visible.length && <li className="rounded-2xl bg-muted px-4 py-8 text-center text-[14px] text-muted-foreground">No tickets here.</li>}
      </ul>
    </aside>
  );
}

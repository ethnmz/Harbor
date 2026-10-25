/** Where a ticket stands, from its status and its latest agent run. Shared by the inbox panes. */
export type TicketState = "new" | "working" | "handled" | "escalated" | "approval" | "resolved";

export function ticketState(status: string, run: { status: string; outcome: string | null } | null): TicketState {
  if (status === "resolved") return "resolved";
  if (!run) return "new";
  if (run.status === "awaiting_approval") return "approval";
  if (run.status === "queued" || run.status === "running") return "working";
  if (run.status === "failed" || run.outcome === "flagged") return "escalated";
  return "handled";
}

export const STATE_LABEL: Record<TicketState, string> = {
  new: "New",
  working: "Agent working",
  handled: "AI handled",
  escalated: "Escalated",
  approval: "Needs approval",
  resolved: "Resolved",
};

export const INBOX_VIEWS = [
  { key: "all", label: "All tickets", match: () => true },
  { key: "needs-you", label: "Needs you", match: (s: TicketState) => s === "escalated" || s === "approval" },
  { key: "ai-handled", label: "AI handled", match: (s: TicketState) => s === "handled" },
  { key: "new", label: "New", match: (s: TicketState) => s === "new" || s === "working" },
  { key: "resolved", label: "Resolved", match: (s: TicketState) => s === "resolved" },
] as const;

export type InboxView = (typeof INBOX_VIEWS)[number]["key"];

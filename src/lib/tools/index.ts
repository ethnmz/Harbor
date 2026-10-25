/**
 * Tool registry. Each agent tool belongs to a workspace connection; agents only ever
 * see the tools their config allows, and risky tools are routed through approvals.
 */
import { eq } from "drizzle-orm";
import { db } from "../db";
import { outboundEmails, refunds, slackMessages, tickets, type Ticket, type Workspace } from "../db/schema";
import { SERPAPI_COST_PER_SEARCH, serpSearch } from "./serpapi";
import { appUrl, isWorkflowWebhook, postToSlack, slackWebhookUrl } from "./slack";

export type ToolContext = {
  runId: string;
  agentId: string;
  agentName: string;
  trigger: string;
  workspace: Workspace;
  ticket: Ticket | null;
  approvalId?: string;
};

export type ToolResult = {
  ok: boolean;
  /** What the model sees (JSON-serialised). */
  output: Record<string, unknown>;
  costUsd?: number;
  /** True when a connection is in offline/simulated mode. */
  simulated?: boolean;
};

export type ConnectionKey = "ticket_inbox" | "serpapi" | "slack" | "billing" | "email";

export type ToolDef = {
  name: string;
  connection: ConnectionKey;
  label: string;
  description: string;
  /** Default risk; the workspace policy decides which tools require approval. */
  risky: boolean;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
};

const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const str = (description: string) => ({ type: "string", description });

export const URGENCIES = ["low", "normal", "high", "urgent"] as const;
export const CATEGORIES = ["outage", "bug", "billing", "security", "privacy", "account", "how_to", "feature_request", "feedback", "other"] as const;

function ticketScope(input: Record<string, unknown>, ctx: ToolContext): ToolResult | null {
  if (!ctx.ticket) return { ok: false, output: { error: "This run has no ticket." } };
  if (input.ticket_id !== ctx.ticket.id)
    return { ok: false, output: { error: `Access denied: this run can only act on ticket ${ctx.ticket.id}.` } };
  return null;
}

export const TOOLS: ToolDef[] = [
  {
    name: "update_ticket",
    connection: "ticket_inbox",
    label: "Update ticket",
    description: "Set the urgency and category of the current support ticket and leave a short internal note for the human team.",
    risky: false,
    inputSchema: obj({
      ticket_id: str("The ticket id, e.g. TCK-1001"),
      urgency: { type: "string", enum: URGENCIES },
      category: { type: "string", enum: CATEGORIES },
      note: str("One or two sentences for the support team explaining the decision"),
    }),
    async execute(input, ctx) {
      const denied = ticketScope(input, ctx);
      if (denied) return denied;
      await db
        .update(tickets)
        .set({
          urgency: String(input.urgency),
          category: String(input.category),
          triageNote: String(input.note),
          status: "triaged",
          handledByAgentId: ctx.agentId,
          updatedAt: new Date(),
        })
        .where(eq(tickets.id, ctx.ticket!.id));
      return { ok: true, output: { updated: ctx.ticket!.id, urgency: input.urgency, category: input.category } };
    },
  },
  {
    name: "lookup_customer",
    connection: "ticket_inbox",
    label: "Look up customer",
    description: "Get the plan, monthly revenue, customer-since date and recent invoices for the customer on the current ticket.",
    risky: false,
    inputSchema: obj({ ticket_id: str("The ticket id") }),
    async execute(input, ctx) {
      const denied = ticketScope(input, ctx);
      if (denied) return denied;
      const t = ctx.ticket!;
      return { ok: true, output: { name: t.customerName, email: t.customerEmail, company: t.company, ...t.customer } };
    },
  },
  {
    name: "news_search",
    connection: "serpapi",
    label: "News search (SerpApi)",
    description:
      "Search Google News through SerpApi. Use it to check whether a third-party service (Cloudflare, Google, AWS, Stripe...) or Tidewell itself has a reported outage right now.",
    risky: false,
    inputSchema: obj({
      query: str("Search query, e.g. 'Cloudflare outage'"),
      recency: { type: "string", enum: ["day", "week", "any"], description: "Limit to news from the last day or week" },
    }),
    async execute(input) {
      const recency = input.recency === "day" ? " when:1d" : input.recency === "week" ? " when:7d" : "";
      const res = await serpSearch("google_news", `${String(input.query)}${recency}`);
      return { ok: true, output: res, costUsd: res.simulated || res.cached ? 0 : SERPAPI_COST_PER_SEARCH, simulated: res.simulated };
    },
  },
  {
    name: "web_search",
    connection: "serpapi",
    label: "Web search (SerpApi)",
    description: "Search Google through SerpApi for status pages, documentation, or anything else on the public web.",
    risky: false,
    inputSchema: obj({ query: str("Search query") }),
    async execute(input) {
      const res = await serpSearch("google", String(input.query));
      return { ok: true, output: res, costUsd: res.simulated || res.cached ? 0 : SERPAPI_COST_PER_SEARCH, simulated: res.simulated };
    },
  },
  {
    name: "post_slack_message",
    connection: "slack",
    label: "Post to Slack",
    description: "Post a short message to an internal Slack channel. Use Slack mrkdwn; include links as <url|title>.",
    risky: false,
    inputSchema: obj({ channel: str("Channel name including #, e.g. #support-urgent"), text: str("Message text") }),
    async execute(input, ctx) {
      const channel = String(input.channel);
      const prefix = ctx.trigger === "test" ? ":test_tube: _Test run_ · " : "";
      const text = `${prefix}${String(input.text)}`;
      const sent = await postToSlack({
        channel,
        text,
        context: `${ctx.agentName} via Harbor${ctx.ticket ? ` · ${ctx.ticket.id}` : ""}`,
        link: { label: "Open run in Harbor", url: `${appUrl()}/runs/${ctx.runId}` },
      });
      await db.insert(slackMessages).values({ runId: ctx.runId, channel, text, delivered: sent.delivered, error: sent.error ?? null });
      return {
        ok: true,
        output: { posted: true, channel, delivered_to_slack: sent.delivered, ...(sent.error ? { note: sent.error } : {}) },
        simulated: !sent.delivered,
      };
    },
  },
  {
    name: "issue_refund",
    connection: "billing",
    label: "Issue refund",
    description: "Refund money to the customer on the current ticket. Requires manager approval; the run pauses until a manager decides.",
    risky: true,
    inputSchema: obj({
      ticket_id: str("The ticket id"),
      amount_usd: { type: "number", description: "Refund amount in USD" },
      invoice_id: str("Invoice being refunded, or empty string if unknown"),
      reason: str("Why this refund is justified"),
    }),
    async execute(input, ctx) {
      const denied = ticketScope(input, ctx);
      if (denied) return denied;
      const amount = Number(input.amount_usd);
      const invoiceId = String(input.invoice_id || "") || null;
      const invoices = ctx.ticket!.customer.invoices;
      if (invoiceId && !invoices.some((i) => i.id === invoiceId))
        return { ok: false, output: { error: `Invoice ${invoiceId} does not belong to this customer.` } };
      const [row] = await db
        .insert(refunds)
        .values({ ticketId: ctx.ticket!.id, runId: ctx.runId, approvalId: ctx.approvalId ?? null, amountUsd: amount, invoiceId, reason: String(input.reason) })
        .returning();
      return { ok: true, output: { refund_id: row.id, amount_usd: amount, invoice_id: invoiceId, status: "submitted", eta: "5-10 business days" } };
    },
  },
  {
    name: "email_customer",
    connection: "email",
    label: "Email customer",
    description: "Send an email about the current ticket, to the ticket's customer unless `to` names another address. May require manager approval.",
    risky: true,
    inputSchema: obj({
      ticket_id: str("The ticket id"),
      to: str("Recipient address. Empty string replies to the customer on the ticket."),
      subject: str("Email subject"),
      body: str("Plain-text email body"),
    }),
    async execute(input, ctx) {
      const denied = ticketScope(input, ctx);
      if (denied) return denied;
      const [row] = await db
        .insert(outboundEmails)
        .values({
          ticketId: ctx.ticket!.id,
          runId: ctx.runId,
          approvalId: ctx.approvalId ?? null,
          toAddress: String(input.to ?? "").trim() || ctx.ticket!.customerEmail,
          subject: String(input.subject),
          body: String(input.body),
        })
        .returning();
      return { ok: true, output: { email_id: row.id, to: row.toAddress, status: "sent (sandbox)" } };
    },
  },
];

/** Built into every agent: how a run reports its result. Not a permission. */
export const FINISH_TOOL = {
  name: "finish_run",
  description:
    "Call this last, on its own, once you have seen the results of your other tool calls. outcome 'handled' = done without needing a human; 'flagged' = a human must follow up.",
  inputSchema: obj({
    outcome: { type: "string", enum: ["handled", "flagged"] },
    summary: str("One or two sentences for the support team about what you did and why"),
  }),
};

export const TOOL_NAMES = TOOLS.map((t) => t.name);
export const getTool = (name: string) => TOOLS.find((t) => t.name === name);

export function connectionStatus(key: ConnectionKey): { live: boolean; detail: string } {
  switch (key) {
    case "serpapi":
      return process.env.SERPAPI_API_KEY
        ? { live: true, detail: "Live Google + Google News via SerpApi" }
        : { live: false, detail: "Simulated results. Set SERPAPI_API_KEY" };
    case "slack": {
      const url = slackWebhookUrl();
      if (!url) return { live: false, detail: "Messages kept in Harbor. Set SLACK_WEBHOOK_URL" };
      return { live: true, detail: isWorkflowWebhook(url) ? "Posting via a Workflow Builder webhook" : "Posting via incoming webhook" };
    }
    case "ticket_inbox":
      return { live: true, detail: "Sandbox helpdesk (seeded tickets)" };
    case "billing":
      return { live: true, detail: "Sandbox ledger: refunds recorded in Postgres" };
    case "email":
      return { live: true, detail: "Sandbox outbox: emails recorded in Postgres" };
  }
}

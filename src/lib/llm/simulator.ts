/**
 * Offline stand-in for a real model, used when no LLM key is configured (or the API
 * is unreachable mid-demo). It plays a competent support agent with simple rules so
 * the whole pipeline — tools, guardrails, approvals, logging — runs end to end.
 * Everything it does is labelled "simulated" in the UI.
 */
import type { ChatRequest, ChatResult, JsonResult, LlmBlock, LlmMessage, LlmProvider } from "./types";

export type TicketFacts = {
  kind: "outage" | "security" | "gdpr" | "refund" | "bug" | "low" | "normal";
  urgency: "low" | "normal" | "high" | "urgent";
  category: string;
  provider: string | null;
  amountUsd: number | null;
  needsHuman: boolean;
};

export function analyzeTicket(subject: string, body: string): TicketFacts {
  const text = `${subject} ${body}`.toLowerCase();
  const provider = /cloudflare/.test(text)
    ? "Cloudflare"
    : /google/.test(text)
      ? "Google"
      : /\baws\b|amazon web services|us-east-1/.test(text)
        ? "AWS"
        : /stripe/.test(text)
          ? "Stripe"
          : null;
  const amountMatch = text.match(/\$\s?(\d+(?:\.\d{1,2})?)/);
  const amountUsd = amountMatch ? Number(amountMatch[1]) : null;
  const base = { provider, amountUsd };

  if (/logged into my account|sign-in from|login from|not me|hacked|unauthori[sz]ed|account takeover/.test(text))
    return { ...base, kind: "security", urgency: "urgent", category: "security", needsHuman: true };
  if (/gdpr|article 17|delete all (my|personal)? ?data|data deletion/.test(text))
    return { ...base, kind: "gdpr", urgency: "high", category: "privacy", needsHuman: true };
  if (/outage|502|bad gateway|is (google|aws|cloudflare|stripe)[^.?!]*(down|outage|issues|problems)|nobody can log in|can't log in|cannot log in|spinner/.test(text))
    return { ...base, kind: "outage", urgency: "urgent", category: "outage", needsHuman: false };
  if (/refund|charged twice|duplicate charge|double charge/.test(text))
    return { ...base, kind: "refund", urgency: "normal", category: "billing", needsHuman: true };
  if (/an hour early|stopped syncing|stopped sync|not syncing|chaos|arriving [^.]*late|\b429\b/.test(text))
    return { ...base, kind: "bug", urgency: "high", category: "bug", needsHuman: false };
  if (/thank/.test(text)) return { ...base, kind: "low", urgency: "low", category: "feedback", needsHuman: false };
  if (/feature|idea|dark mode/.test(text)) return { ...base, kind: "low", urgency: "low", category: "feature_request", needsHuman: false };
  if (/how do i|is there a way|export|what's the limit/.test(text))
    return { ...base, kind: "low", urgency: "low", category: "how_to", needsHuman: false };
  return { ...base, kind: "normal", urgency: "normal", category: "other", needsHuman: false };
}

type ParsedTicket = { id: string; subject: string; body: string; from: string };

function parseTicket(messages: LlmMessage[]): ParsedTicket | null {
  const first = messages[0]?.content.find((b) => b.type === "text");
  if (!first || first.type !== "text") return null;
  const block = first.text.match(/<ticket>([\s\S]*?)<\/ticket>/)?.[1];
  if (!block) return null;
  const line = (k: string) => block.match(new RegExp(`^${k}: (.*)$`, "m"))?.[1]?.trim() ?? "";
  return { id: line("id"), subject: line("subject"), from: line("from"), body: block.split(/^body:\s*$/m)[1]?.trim() ?? "" };
}

function toolHistory(messages: LlmMessage[]) {
  const calls: { id: string; name: string; input: Record<string, unknown> }[] = [];
  const results = new Map<string, { content: string; isError?: boolean }>();
  for (const m of messages)
    for (const b of m.content) {
      if (b.type === "tool_call") calls.push(b);
      if (b.type === "tool_result") results.set(b.toolCallId, b);
    }
  return calls.map((c) => ({ ...c, result: results.get(c.id) }));
}

let counter = 0;
const callId = () => `toolu_sim_${Date.now().toString(36)}${(counter++).toString(36)}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function firstNewsHit(content: string | undefined) {
  try {
    const parsed = JSON.parse(content ?? "{}");
    return (parsed.results?.[0] ?? null) as { title: string; link: string; source?: string; date?: string } | null;
  } catch {
    return null;
  }
}

function plan(req: ChatRequest): { text: string; calls: { name: string; input: Record<string, unknown> }[] } {
  const ticket = parseTicket(req.messages);
  const has = (n: string) => req.tools.some((t) => t.name === n);
  const history = toolHistory(req.messages);
  const called = (n: string) => history.some((h) => h.name === n);
  const resultOf = (n: string) => [...history].reverse().find((h) => h.name === n)?.result;

  if (!ticket) {
    return { text: "I couldn't find a ticket in the request.", calls: has("finish_run") ? [{ name: "finish_run", input: { outcome: "flagged", summary: "No ticket was provided." } }] : [] };
  }
  const f = analyzeTicket(ticket.subject, ticket.body);
  const refundMode = has("issue_refund");
  const limit = Number(req.system.match(/Refund limit: \$(\d+(?:\.\d+)?)/)?.[1] ?? 150);
  const customer = ticket.from.split(" <")[0];

  // Research
  if (!called("update_ticket")) {
    if (refundMode && f.kind === "refund" && has("lookup_customer") && !called("lookup_customer"))
      return { text: "Let me verify the charge on the customer's account first.", calls: [{ name: "lookup_customer", input: { ticket_id: ticket.id } }] };
    if (!refundMode && f.kind === "outage" && has("news_search") && !called("news_search")) {
      const q = f.provider ? `${f.provider} outage` : "Tidewell outage";
      return { text: `The customer mentions a possible outage. Checking the news for "${q}".`, calls: [{ name: "news_search", input: { query: q, recency: "day" } }] };
    }
  }

  // Decide and act
  if (!called("update_ticket")) {
    const calls: { name: string; input: Record<string, unknown> }[] = [];
    if (refundMode) {
      if (f.kind !== "refund") {
        calls.push({ name: "update_ticket", input: { ticket_id: ticket.id, urgency: f.urgency, category: f.category, note: "Not a refund request; left for the triage queue." } });
      } else if (f.amountUsd !== null && f.amountUsd <= limit) {
        const lookup = resultOf("lookup_customer");
        const invoice = lookup?.content.match(/"id":"(INV-[\w-]+)"/)?.[1] ?? null;
        calls.push(
          { name: "issue_refund", input: { ticket_id: ticket.id, amount_usd: f.amountUsd, invoice_id: invoice ?? "", reason: `Customer request: ${ticket.subject}` } },
          {
            name: "email_customer",
            input: {
              ticket_id: ticket.id,
              subject: `Your refund of $${f.amountUsd.toFixed(2)} is on its way`,
              body: `Hi ${customer.split(" ")[0]},\n\nThanks for flagging this. We've refunded $${f.amountUsd.toFixed(2)}${invoice ? ` for ${invoice}` : ""}. It should appear on your statement within 5-10 business days.\n\nSorry for the hassle,\nTidewell Support`,
            },
          },
          { name: "update_ticket", input: { ticket_id: ticket.id, urgency: "normal", category: "billing", note: `Refund of $${f.amountUsd} verified and submitted for approval.` } },
        );
      } else {
        calls.push(
          { name: "update_ticket", input: { ticket_id: ticket.id, urgency: "high", category: "billing", note: `Refund of $${f.amountUsd ?? "?"} is over the $${limit} limit; needs a manager.` } },
          ...(has("post_slack_message")
            ? [{ name: "post_slack_message", input: { channel: "#support-billing", text: `Refund over limit: ${customer} (${ticket.id}) asks for $${f.amountUsd ?? "?"} — "${ticket.subject}". Needs a manager decision.` } }]
            : []),
        );
      }
      return { text: "I've verified the request. Taking action now.", calls };
    }

    const news = firstNewsHit(resultOf("news_search")?.content);
    const evidence = f.kind === "outage" ? (news ? ` News: "${news.title}" (${news.source ?? "source"}) ${news.link}` : " No matching outage reports found in the news.") : "";
    const notes: Record<TicketFacts["kind"], string> = {
      outage: `Customer reports a ${f.provider ?? "service"} outage blocking many users.${evidence}`,
      security: "Possible account takeover with access to client medical notes. Escalate to security now.",
      gdpr: "GDPR Article 17 deletion request. Legal deadline applies; route to the privacy team.",
      refund: `Refund request${f.amountUsd ? ` for $${f.amountUsd}` : ""}. Route to billing.`,
      bug: "A core workflow is broken for this customer. Needs engineering follow-up today.",
      low: "No time pressure. Can be answered from the help center.",
      normal: "Standard request. Reply within one business day.",
    };
    calls.push({ name: "update_ticket", input: { ticket_id: ticket.id, urgency: f.urgency, category: f.category, note: notes[f.kind] } });
    if (f.urgency === "urgent" && has("post_slack_message")) {
      const impact = f.kind === "security" ? "possible account takeover" : `${ticket.subject.toLowerCase()}`;
      calls.push({
        name: "post_slack_message",
        input: {
          channel: "#support-urgent",
          text: `:rotating_light: *Urgent* — ${customer} (${ticket.id}): ${impact}.${news ? `\nOutage evidence: <${news.link}|${news.title}> (${news.source ?? "news"})` : ""}`,
        },
      });
    }
    return { text: `This looks ${f.urgency}. Recording the triage decision.`, calls };
  }

  if (!called("finish_run") && has("finish_run")) {
    const rejected = history.some((h) => h.result?.isError && /rejected/i.test(h.result.content));
    const blocked = history.some((h) => h.result?.isError && /blocked|exceeds|not permitted/i.test(h.result.content));
    let outcome: "handled" | "flagged" = f.needsHuman || blocked || rejected ? "flagged" : "handled";
    let summary: string;
    if (refundMode) {
      if (f.kind !== "refund") {
        outcome = "handled";
        summary = "Not a refund request, so no refund was issued.";
      } else if (rejected) summary = "The manager rejected the refund, so nothing was issued. Ticket left for billing.";
      else if (called("issue_refund")) {
        outcome = "handled";
        summary = `Refunded $${f.amountUsd} to ${customer} after manager approval and emailed a confirmation.`;
      } else summary = `Refund of $${f.amountUsd ?? "?"} exceeds the $${limit} limit, escalated to #support-billing.`;
    } else {
      const posted = called("post_slack_message") ? " Posted to #support-urgent." : "";
      summary = `Triaged as ${f.urgency} (${f.category}).${posted}`;
    }
    return { text: "All done.", calls: [{ name: "finish_run", input: { outcome, summary } }] };
  }

  return { text: "Done.", calls: [] };
}

const approxTokens = (s: string) => Math.ceil(s.length / 4);

export const simulatorProvider: LlmProvider = {
  id: "simulated",
  label: "Harbor simulator",
  live: false,

  async chat(req: ChatRequest): Promise<ChatResult> {
    await sleep(350 + Math.random() * 650);
    const { text, calls } = plan(req);
    const content: LlmBlock[] = [{ type: "text", text }, ...calls.map((c) => ({ type: "tool_call" as const, id: callId(), name: c.name, input: c.input }))];
    const promptChars = req.system.length + JSON.stringify(req.tools).length + JSON.stringify(req.messages.map((m) => m.content)).length;
    return {
      content,
      stopReason: calls.length ? "tool_use" : "end_turn",
      usage: { inputTokens: approxTokens(" ".repeat(promptChars)), outputTokens: 40 + approxTokens(JSON.stringify(content)) },
      model: "harbor-simulator",
      provider: "simulated",
    };
  },

  async json(): Promise<JsonResult> {
    throw new Error("The simulator does not generate JSON; callers use their own heuristic fallback.");
  },
};

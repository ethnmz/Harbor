/** Display metadata for agents and templates (client-safe: no server imports). */

const TOOL_TAG: Record<string, string> = {
  update_ticket: "Ticket triage",
  lookup_customer: "Customer lookup",
  news_search: "News search",
  web_search: "Web search",
  post_slack_message: "Slack alerts",
  issue_refund: "Refunds",
  email_customer: "Customer email",
};

export type AgentCategory = "Support" | "Billing" | "Operations";
export const CATEGORIES: AgentCategory[] = ["Support", "Billing", "Operations"];

export function agentCategory(name: string, description: string, tools: string[]): AgentCategory {
  const text = `${name} ${description}`.toLowerCase();
  if (tools.includes("issue_refund") || /refund|billing|invoice|charge/.test(text)) return "Billing";
  if (/outage|incident|status|uptime/.test(text) && !/triage|sort/.test(text)) return "Operations";
  return "Support";
}

export function agentTags(tools: string[], max = 3) {
  return tools.map((t) => TOOL_TAG[t]).filter(Boolean).slice(0, max);
}

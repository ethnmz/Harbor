import type { Guardrails, TicketCustomer, WorkspacePolicies } from "./db/schema";

export const DEMO_WORKSPACE = {
  name: "Tidewell Support",
  company: "Tidewell",
  ownerName: "Maya Okafor",
  ownerEmail: "maya@tidewell.app",
};

export const DEFAULT_POLICIES: WorkspacePolicies = {
  approvalRequiredTools: ["issue_refund", "email_customer"],
  maxRefundUsd: 150,
  maxStepsPerRun: 12,
  maxCostPerRunUsd: 0.5,
  allowedSlackChannels: ["#support-urgent", "#support-billing", "#support-triage"],
  rules: [
    "Never ask a customer for a full card number, password, or one-time code.",
    "Never promise SLA credits or delivery dates; escalate those to a human.",
    "Treat security incidents and data-deletion (GDPR) requests as urgent and escalate them.",
    "Customer-facing messages are warm, concise, and say exactly what happens next.",
  ],
};

export const TOOL_CONNECTIONS = [
  { key: "ticket_inbox", name: "Support inbox", config: { source: "Tidewell Helpdesk (sandbox)" } },
  { key: "serpapi", name: "SerpApi web & news search", config: { engines: ["google", "google_news"], resultsPerQuery: 5 } },
  { key: "slack", name: "Slack", config: { defaultChannel: "#support-urgent", approvalsChannel: "#support-leads" } },
  { key: "billing", name: "Billing (refunds)", config: { processor: "Sandbox ledger" } },
  { key: "email", name: "Customer email", config: { from: "support@tidewell.app" } },
] as const;

type SeedTicket = {
  id: string;
  subject: string;
  body: string;
  customerName: string;
  customerEmail: string;
  company: string;
  customer: TicketCustomer;
  channel: string;
  inTestSet: boolean;
  minutesAgo: number;
};

const inv = (id: string, amountUsd: number, date: string, status = "paid") => ({ id, amountUsd, date, status });

export const SEED_TICKETS: SeedTicket[] = [
  {
    id: "TCK-1001",
    subject: "Checkout page throwing 502s for ALL our clients",
    body: "Since about 9:40am every client who tries to pay a deposit on our booking page gets a 502 Bad Gateway. My front desk says people on X are talking about a Cloudflare outage. Is this you or them?? We're losing bookings every minute. Please help ASAP.",
    customerName: "Dr. Elena Ruiz",
    customerEmail: "elena@pinecrestdental.com",
    company: "Pinecrest Dental",
    customer: { plan: "Business", mrrUsd: 349, customerSince: "2022-03-14", invoices: [inv("INV-20811", 349, "2026-10-01")] },
    channel: "email",
    inTestSet: true,
    minutesAgo: 6,
  },
  {
    id: "TCK-1002",
    subject: "Nobody can log in with Google",
    body: "All 40 of our stylists are stuck on the 'Sign in with Google' spinner this morning. Password login works for the two admins who have one. Is Google having an outage? Saturday is our busiest day.",
    customerName: "Marcus Lee",
    customerEmail: "marcus@studiomarlo.co",
    company: "Studio Marlo Salons",
    customer: { plan: "Business", mrrUsd: 520, customerSince: "2021-11-02", invoices: [inv("INV-20802", 520, "2026-10-01")] },
    channel: "chat",
    inTestSet: true,
    minutesAgo: 11,
  },
  {
    id: "TCK-1003",
    subject: "Charged twice for October",
    body: "Hi there, I see two charges of $49.00 on my card for the October invoice (INV-20931), both on Oct 1. Could you refund the duplicate please? Thanks, Priya",
    customerName: "Priya Natarajan",
    customerEmail: "priya@northshoreyoga.com",
    company: "Northshore Yoga",
    customer: {
      plan: "Starter",
      mrrUsd: 49,
      customerSince: "2024-06-20",
      invoices: [inv("INV-20931", 49, "2026-10-01"), inv("INV-20931-DUP", 49, "2026-10-01", "paid (duplicate)")],
    },
    channel: "email",
    inTestSet: true,
    minutesAgo: 18,
  },
  {
    id: "TCK-1004",
    subject: "Upgraded to annual by mistake — please refund",
    body: "I clicked the annual plan by accident yesterday and got charged $228. I want to stay on monthly. Can you refund the annual charge and switch me back? I haven't used any annual features.",
    customerName: "Tom Becker",
    customerEmail: "tom@beckerphysio.de",
    company: "Becker Physio",
    customer: {
      plan: "Starter (annual)",
      mrrUsd: 19,
      customerSince: "2025-02-11",
      invoices: [inv("INV-21007", 228, "2026-10-23"), inv("INV-20755", 19, "2026-09-11")],
    },
    channel: "email",
    inTestSet: true,
    minutesAgo: 25,
  },
  {
    id: "TCK-1005",
    subject: "How do I export my client list?",
    body: "Is there a way to export all my clients (name, phone, email) to a CSV? I want to send a holiday card mailing. No rush.",
    customerName: "Grace Kim",
    customerEmail: "grace@kimacupuncture.com",
    company: "Kim Acupuncture",
    customer: { plan: "Starter", mrrUsd: 49, customerSince: "2023-08-01", invoices: [inv("INV-20901", 49, "2026-10-01")] },
    channel: "email",
    inTestSet: true,
    minutesAgo: 31,
  },
  {
    id: "TCK-1006",
    subject: "Reminder texts going out an hour early",
    body: "Since last weekend all our SMS appointment reminders are arriving one hour early. Patients are showing up at the wrong time. I think it started with the daylight saving change. This is causing real chaos at the front desk.",
    customerName: "Alicia Moreno",
    customerEmail: "alicia@brightsmilesortho.com",
    company: "Bright Smiles Orthodontics",
    customer: { plan: "Business", mrrUsd: 349, customerSince: "2022-09-30", invoices: [inv("INV-20845", 349, "2026-10-01")] },
    channel: "email",
    inTestSet: true,
    minutesAgo: 40,
  },
  {
    id: "TCK-1007",
    subject: "Please delete all my data (GDPR)",
    body: "I closed my practice last month. Under GDPR Article 17 I request deletion of all personal data you hold about me and my former clients. Please confirm in writing when complete.",
    customerName: "Sophie Laurent",
    customerEmail: "sophie.laurent@cabinet-laurent.fr",
    company: "Cabinet Laurent (closed)",
    customer: { plan: "Cancelled", mrrUsd: 0, customerSince: "2023-01-09", invoices: [inv("INV-20120", 49, "2026-09-01")] },
    channel: "email",
    inTestSet: true,
    minutesAgo: 52,
  },
  {
    id: "TCK-1008",
    subject: "Feature idea: dark mode for the calendar",
    body: "Love the product! Any plans for a dark mode? I do my scheduling late at night and the white calendar is bright. Not urgent at all.",
    customerName: "Jordan Blake",
    customerEmail: "jordan@blakefitness.com",
    company: "Blake Fitness",
    customer: { plan: "Starter", mrrUsd: 49, customerSince: "2025-05-05", invoices: [inv("INV-20977", 49, "2026-10-05")] },
    channel: "chat",
    inTestSet: true,
    minutesAgo: 64,
  },
  {
    id: "TCK-1009",
    subject: "Someone logged into my account from another country",
    body: "I just got a 'new login' email from Tidewell for a sign-in from Lagos. That was not me. I've changed my password but I'm worried they saw client medical notes. What do I do?",
    customerName: "Hannah Weiss",
    customerEmail: "hannah@weisstherapy.com",
    company: "Weiss Therapy",
    customer: { plan: "Business", mrrUsd: 349, customerSince: "2021-04-18", invoices: [inv("INV-20850", 349, "2026-10-01")] },
    channel: "email",
    inTestSet: true,
    minutesAgo: 71,
  },
  {
    id: "TCK-1010",
    subject: "Outlook calendar sync stopped",
    body: "Our Outlook calendar stopped syncing two days ago. New Tidewell bookings don't show up in Outlook anymore. Reconnecting didn't help. Can someone take a look this week?",
    customerName: "Ben Carter",
    customerEmail: "ben@cartervet.com",
    company: "Carter Veterinary",
    customer: { plan: "Business", mrrUsd: 349, customerSince: "2023-03-03", invoices: [inv("INV-20866", 349, "2026-10-01")] },
    channel: "email",
    inTestSet: true,
    minutesAgo: 85,
  },
  // Not in the test set: the live inbox the deployed agent picks up.
  {
    id: "TCK-1011",
    subject: "Can't upload our new logo",
    body: "The logo uploader says 'file too large' for a 3MB PNG. What's the limit? Our rebrand launches Monday.",
    customerName: "Lena Fischer",
    customerEmail: "lena@fischerhair.de",
    company: "Fischer Hair",
    customer: { plan: "Starter", mrrUsd: 49, customerSince: "2024-10-10", invoices: [inv("INV-20990", 49, "2026-10-10")] },
    channel: "chat",
    inTestSet: false,
    minutesAgo: 3,
  },
  {
    id: "TCK-1012",
    subject: "Thank you to Priya on your team!",
    body: "Just wanted to say Priya was amazing on our onboarding call yesterday. Please pass it on!",
    customerName: "Omar Haddad",
    customerEmail: "omar@haddadchiro.com",
    company: "Haddad Chiropractic",
    customer: { plan: "Business", mrrUsd: 349, customerSince: "2026-10-20", invoices: [inv("INV-21001", 349, "2026-10-20")] },
    channel: "email",
    inTestSet: false,
    minutesAgo: 9,
  },
  {
    id: "TCK-1013",
    subject: "Refund for unused SMS credits?",
    body: "We bought a $60 SMS credit pack last week but switched to email reminders. Could we get a refund for the unused pack? It hasn't been touched.",
    customerName: "Rachel Owens",
    customerEmail: "rachel@owensderm.com",
    company: "Owens Dermatology",
    customer: {
      plan: "Business",
      mrrUsd: 349,
      customerSince: "2022-12-12",
      invoices: [inv("INV-21002", 60, "2026-10-17"), inv("INV-20870", 349, "2026-10-01")],
    },
    channel: "email",
    inTestSet: false,
    minutesAgo: 14,
  },
  {
    id: "TCK-1014",
    subject: "API returning 429 since adding second location",
    body: "Our integration started getting HTTP 429 Too Many Requests after we added our second clinic. We sync every 30 seconds. Is there a per-account rate limit we can raise?",
    customerName: "Dev Patel",
    customerEmail: "dev@citycarephysio.com",
    company: "CityCare Physio",
    customer: { plan: "Enterprise", mrrUsd: 1200, customerSince: "2020-07-07", invoices: [inv("INV-20799", 1200, "2026-10-01")] },
    channel: "email",
    inTestSet: false,
    minutesAgo: 20,
  },
  {
    id: "TCK-1015",
    subject: "Webhooks arriving 30 minutes late",
    body: "Booking webhooks are arriving 20-30 minutes late since this morning. Our waitlist automation depends on them. Anything going on?",
    customerName: "Chloe Martin",
    customerEmail: "chloe@martinwellness.com",
    company: "Martin Wellness",
    customer: { plan: "Enterprise", mrrUsd: 900, customerSince: "2021-02-22", invoices: [inv("INV-20801", 900, "2026-10-01")] },
    channel: "email",
    inTestSet: false,
    minutesAgo: 27,
  },
];

export const DEFAULT_GUARDRAILS = (p: WorkspacePolicies): Guardrails => ({
  maxSteps: p.maxStepsPerRun,
  maxCostUsd: p.maxCostPerRunUsd,
  maxRefundUsd: p.maxRefundUsd,
  allowedSlackChannels: p.allowedSlackChannels,
  rules: [],
});

/** Starter templates in the gallery. Also the offline fallback for config generation. */
export const BUILTIN_TEMPLATES = [
  {
    key: "triage",
    name: "Ticket Triage",
    description: "Sorts incoming tickets by urgency, checks the news for third-party outages, and pings Slack for urgent ones.",
    prompt:
      "Sort incoming support tickets by urgency, look up outage news if a ticket mentions an outage, and post urgent ones to #support-urgent.",
    instructions: [
      "You triage incoming Tidewell support tickets.",
      "1. Read the ticket and decide its urgency: urgent (many users blocked, money or security at risk), high (a key workflow is broken for one customer), normal (needs a reply within a day), low (questions, ideas, thanks).",
      "2. If the ticket mentions an outage or a third-party provider being down (Cloudflare, Google, AWS, Stripe...), use news_search to check for current outage reports before deciding. Mention what you found, with the source, in your note.",
      "3. Record your decision with update_ticket (urgency, category, and a one-line note for the human team).",
      "4. If the ticket is urgent, post a short summary to #support-urgent with post_slack_message: customer, impact, and any outage evidence with a link.",
      "5. Finish with finish_run. Use outcome 'flagged' when a human must act (security, legal, refunds, angry high-value customers), otherwise 'handled'.",
    ].join("\n"),
    allowedTools: ["update_ticket", "lookup_customer", "news_search", "web_search", "post_slack_message"],
    riskyTools: [] as string[],
  },
  {
    key: "refund",
    name: "Refund Handler",
    description: "Verifies refund requests against billing history and issues refunds within policy, with manager approval.",
    prompt: "Handle refund requests: verify the charge, issue the refund if it's within policy, and email the customer.",
    instructions: [
      "You handle refund requests for Tidewell.",
      "1. If the ticket is not a refund request, set it to normal urgency with update_ticket and finish with outcome 'handled' and a note that no refund was needed.",
      "2. Use lookup_customer to verify the charge on the customer's invoices before doing anything.",
      "3. If the refund is legitimate and within the workspace refund limit, call issue_refund AND email_customer in the same step (parallel tool calls), so the manager approves both together. The email confirms the amount and that it takes 5-10 business days.",
      "4. If the amount is over the refund limit or you cannot verify the charge, do not refund: update_ticket with urgency high and a clear note, post to #support-billing, and finish with outcome 'flagged'.",
      "5. Finish with finish_run summarising what happened.",
    ].join("\n"),
    allowedTools: ["update_ticket", "lookup_customer", "issue_refund", "email_customer", "post_slack_message"],
    riskyTools: ["issue_refund", "email_customer"],
  },
  {
    key: "outage",
    name: "Outage Watcher",
    description: "Checks every ticket that smells like an outage against live news and status pages, then alerts the on-call channel.",
    prompt: "When customers report something down, check live news and the web for an outage, and alert #support-urgent with evidence.",
    instructions: [
      "You watch for outages in Tidewell support tickets.",
      "1. If the ticket does not describe something being down or broken for many users, mark it normal with update_ticket and finish with outcome 'handled'.",
      "2. Otherwise search news_search and web_search for a matching third-party or Tidewell outage. Prefer results from the last 24 hours.",
      "3. Mark the ticket urgent with update_ticket, including the evidence you found.",
      "4. Post to #support-urgent with the customer impact and the top two sources (title + link).",
      "5. Finish with finish_run.",
    ].join("\n"),
    allowedTools: ["update_ticket", "news_search", "web_search", "post_slack_message"],
    riskyTools: [] as string[],
  },
];

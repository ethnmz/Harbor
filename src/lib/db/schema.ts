import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  uniqueIndex,
  boolean,
  doublePrecision,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Shared JSON shapes
// ---------------------------------------------------------------------------

export type WorkspacePolicies = {
  /** Tools that always need a human approval, whatever an agent's config says. */
  approvalRequiredTools: string[];
  maxRefundUsd: number;
  maxStepsPerRun: number;
  maxCostPerRunUsd: number;
  allowedSlackChannels: string[];
  /** Plain-English rules injected into every agent's instructions. */
  rules: string[];
  /** From onboarding; kept in this JSON column so it needs no migration. Given to the config generator as context. */
  profile?: CompanyProfile;
};

export type CompanyProfile = { size: string; kinds: string[] };

export type Guardrails = {
  maxSteps: number;
  maxCostUsd: number;
  maxRefundUsd: number;
  allowedSlackChannels: string[];
  rules: string[];
  /** Enforced in the tool layer (self-healing can add these). Absent = not enforced. */
  emailRecipients?: "any" | "ticket_customer";
  /** Block outbound text (emails, Slack) that contains any email address other than the ticket customer's. */
  blockForeignEmails?: boolean;
  /** Refunds must name an invoice that belongs to the ticket's customer. */
  requireInvoiceForRefund?: boolean;
};

export type TicketCustomer = {
  plan: string;
  mrrUsd: number;
  customerSince: string;
  invoices: { id: string; amountUsd: number; date: string; status: string }[];
};

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  company: text("company").notNull(),
  ownerName: text("owner_name").notNull(),
  ownerEmail: text("owner_email").notNull(),
  defaultModel: text("default_model").notNull(),
  policies: jsonb("policies").$type<WorkspacePolicies>().notNull(),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Workspace-level connections. Secrets stay in env vars; only non-secret config lives here. */
export const tools = pgTable("tools", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  key: text("key").notNull(), // serpapi | slack | ticket_inbox | billing | email
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  /** What the user originally typed. */
  prompt: text("prompt").notNull().default(""),
  instructions: text("instructions").notNull(),
  allowedTools: jsonb("allowed_tools").$type<string[]>().notNull(),
  riskyTools: jsonb("risky_tools").$type<string[]>().notNull(),
  model: text("model").notNull(),
  guardrails: jsonb("guardrails").$type<Guardrails>().notNull(),
  /** Shown in the template gallery. */
  published: boolean("published").notNull().default(false),
  builtin: boolean("builtin").notNull().default(false),
  sourceTemplateId: uuid("source_template_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  templateId: uuid("template_id")
    .notNull()
    .references(() => templates.id),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"), // draft | live | paused
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deployedAt: timestamp("deployed_at", { withTimezone: true }),
});

export const tickets = pgTable("tickets", {
  id: text("id").primaryKey(), // e.g. TCK-1001
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  company: text("company").notNull(),
  customer: jsonb("customer").$type<TicketCustomer>().notNull(),
  channel: text("channel").notNull().default("email"),
  /** Part of the 10-ticket test set. */
  inTestSet: boolean("in_test_set").notNull().default(false),
  /** Synthetic ticket for red-team attacks; hidden from the inbox, test set and stats. */
  sandbox: boolean("sandbox").notNull().default(false),
  status: text("status").notNull().default("open"), // open | triaged | resolved
  urgency: text("urgency"), // low | normal | high | urgent
  category: text("category"),
  triageNote: text("triage_note"),
  handledByAgentId: uuid("handled_by_agent_id"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    ticketId: text("ticket_id").references(() => tickets.id),
    batchId: uuid("batch_id"),
    trigger: text("trigger").notNull(), // test | manual | live | redteam | verify (the last two run sandboxed)
    /** The agent version this run used (null for runs before versioning). */
    agentVersion: integer("agent_version"),
    status: text("status").notNull().default("queued"), // queued | running | awaiting_approval | completed | failed
    outcome: text("outcome"), // handled | flagged | failed
    summary: text("summary"),
    model: text("model").notNull(),
    provider: text("provider").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    toolCalls: integer("tool_calls").notNull().default(0),
    costEstimate: doublePrecision("cost_estimate").notNull().default(0),
    /** Conversation state, so a run can pause for approval and resume later. */
    state: jsonb("state").$type<Record<string, unknown>>(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [index("runs_agent_idx").on(t.agentId, t.createdAt), index("runs_batch_idx").on(t.batchId)],
);

export const runSteps = pgTable(
  "run_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    type: text("type").notNull(), // llm | tool | approval | guardrail | error | final
    toolName: text("tool_name"),
    status: text("status").notNull().default("ok"), // ok | error | blocked | pending | approved | rejected
    input: jsonb("input"),
    output: jsonb("output"),
    latencyMs: integer("latency_ms").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cost: doublePrecision("cost").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("run_steps_run_idx").on(t.runId, t.seq)],
);

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    stepId: uuid("step_id").references(() => runSteps.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    ticketId: text("ticket_id"),
    toolCallId: text("tool_call_id").notNull(),
    action: text("action").notNull(), // tool name
    args: jsonb("args").$type<Record<string, unknown>>().notNull(),
    reason: text("reason"),
    status: text("status").notNull().default("pending"), // pending | approved | rejected
    decidedBy: text("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("approvals_status_idx").on(t.status, t.createdAt)],
);

/** Append-only. On Tiger Cloud this becomes a TimescaleDB hypertable with a retention policy. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").notNull().defaultRandom(),
    workspaceId: uuid("workspace_id"),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    target: text("target"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.id, t.createdAt] }), index("audit_created_idx").on(t.createdAt)],
);

// Side effects of the mock tools ----------------------------------------------

export const refunds = pgTable("refunds", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: text("ticket_id"),
  runId: uuid("run_id").references(() => runs.id, { onDelete: "cascade" }),
  approvalId: uuid("approval_id"),
  amountUsd: doublePrecision("amount_usd").notNull(),
  invoiceId: text("invoice_id"),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const outboundEmails = pgTable("outbound_emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: text("ticket_id"),
  runId: uuid("run_id").references(() => runs.id, { onDelete: "cascade" }),
  approvalId: uuid("approval_id"),
  toAddress: text("to_address").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const slackMessages = pgTable("slack_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").references(() => runs.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),
  text: text("text").notNull(),
  delivered: boolean("delivered").notNull(),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Immutable snapshots of an agent's config. The agent's active version is the one whose template it points at. */
export const agentVersions = pgTable(
  "agent_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => templates.id),
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    createdFromPatch: uuid("created_from_patch"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("agent_versions_agent_version_idx").on(t.agentId, t.version)],
);

export const redteamRuns = pgTable(
  "redteam_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    agentVersion: integer("agent_version").notNull(),
    status: text("status").notNull().default("generating"), // generating | running | completed | failed
    /** generated | fallback | rerun */
    source: text("source").notNull().default("generated"),
    /** manual | verify */
    purpose: text("purpose").notNull().default("manual"),
    healPatchId: uuid("heal_patch_id"),
    score: integer("score"),
    total: integer("total"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("redteam_runs_agent_idx").on(t.agentId, t.createdAt)],
);

export const redteamCases = pgTable(
  "redteam_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => redteamRuns.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    category: text("category").notNull(),
    attackSubject: text("attack_subject").notNull(),
    attackText: text("attack_text").notNull(),
    /** What a safe agent should do, used by the judge. */
    expectation: text("expectation").notNull().default(""),
    result: text("result").notNull().default("pending"), // pending | running | pass | fail | error
    reason: text("reason"),
    evidence: jsonb("evidence").$type<Record<string, unknown>>(),
    ticketId: text("ticket_id"),
    agentRunId: uuid("agent_run_id"),
    originCaseId: uuid("origin_case_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("redteam_cases_run_idx").on(t.runId, t.seq)],
);

export const healPatches = pgTable("heal_patches", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  fromVersion: integer("from_version").notNull(),
  toVersion: integer("to_version"),
  /** proposed | rejected | verifying | verified | regressed | failed */
  status: text("status").notNull().default("proposed"),
  /** llm | fallback */
  source: text("source").notNull(),
  /** 1 = accepted by a person; 2-3 = automatic follow-up iterations. */
  iteration: integer("iteration").notNull().default(1),
  parentPatchId: uuid("parent_patch_id"),
  redteamRunId: uuid("redteam_run_id"),
  patch: jsonb("patch").$type<Record<string, unknown>>().notNull(),
  verification: jsonb("verification").$type<Record<string, unknown>>(),
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Workspace = typeof workspaces.$inferSelect;
export type ToolConnection = typeof tools.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type RunStep = typeof runSteps.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;

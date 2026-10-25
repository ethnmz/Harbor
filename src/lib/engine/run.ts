/**
 * The agent runtime. A manual tool-use loop (rather than an SDK tool runner) because a
 * run must be able to pause on a risky action, persist its conversation to Postgres,
 * and resume in a different request once a manager approves.
 */
import { and, asc, eq, inArray, notExists, sql as dsql } from "drizzle-orm";
import { db } from "../db";
import {
  agentVersions,
  agents,
  approvals,
  runSteps,
  runs,
  templates,
  tickets,
  tools as toolConnections,
  workspaces,
  type Agent,
  type Run,
  type Template,
  type Ticket,
  type Workspace,
} from "../db/schema";
import { audit } from "../audit";
import { getProvider, isTransientLlmError, simulatorFallbackEnabled, simulatorProvider, textOf, type ChatResult, type LlmBlock, type LlmMessage, type LlmToolSpec } from "../llm";
import { llmCost } from "../llm/models";
import { FINISH_TOOL, getTool, type ToolContext } from "../tools";
import { appUrl, postToSlack } from "../tools/slack";
import { slackMessages } from "../db/schema";
import { configFromTemplate, type AgentConfig } from "./config";
import { buildSystemPrompt, ticketMessage } from "./prompt";
import { activeVersionNumber } from "./versions";

/** Triggers that run sandboxed: writes are intercepted and recorded, never executed. */
export const SANDBOX_TRIGGERS = new Set(["redteam", "verify"]);
/** Tools with side effects. Read-only tools (lookups, searches) run normally in the sandbox. */
const WRITE_TOOLS = new Set(["issue_refund", "email_customer", "post_slack_message", "update_ticket"]);
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

type ToolCall = Extract<LlmBlock, { type: "tool_call" }>;
type ToolResultBlock = Extract<LlmBlock, { type: "tool_result" }>;

export type RunState = {
  messages: LlmMessage[];
  llmCalls: number;
  provider: string;
  pending?: {
    calls: ToolCall[];
    results: Record<string, ToolResultBlock>;
    finish?: { outcome: string; summary: string };
  };
};

type Ctx = {
  run: Run;
  agent: Agent;
  template: Template;
  cfg: AgentConfig;
  ws: Workspace;
  ticket: Ticket | null;
  system: string;
  toolSpecs: LlmToolSpec[];
  disabledConnections: Set<string>;
  /** Red-team / verification run: intercept writes instead of executing them. */
  sandbox: boolean;
  seq: number;
  totals: { inputTokens: number; outputTokens: number; cost: number; toolCalls: number };
};

// ---------------------------------------------------------------------------
// Creating runs
// ---------------------------------------------------------------------------

export async function createRun(
  agentId: string,
  ticketId: string,
  trigger: "test" | "manual" | "live" | "redteam" | "verify",
  batchId?: string,
  opts: { agentVersion?: number } = {},
) {
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
  if (!agent) throw new Error("Agent not found");
  // A specific version can be run (re-verification); otherwise the active one.
  let templateId = agent.templateId;
  let agentVersion = await activeVersionNumber(agentId, agent.templateId);
  if (opts.agentVersion != null) {
    const [v] = await db.select().from(agentVersions).where(and(eq(agentVersions.agentId, agentId), eq(agentVersions.version, opts.agentVersion)));
    if (!v) throw new Error(`Version ${opts.agentVersion} not found`);
    templateId = v.templateId;
    agentVersion = v.version;
  }
  const [template] = await db.select().from(templates).where(eq(templates.id, templateId));
  const [run] = await db
    .insert(runs)
    .values({ agentId, ticketId, trigger, batchId: batchId ?? null, model: template.model, provider: getProvider().id, agentVersion })
    .returning();
  return run;
}

export async function createTestBatch(agentId: string) {
  const testTickets = await db.select().from(tickets).where(eq(tickets.inTestSet, true)).orderBy(asc(tickets.receivedAt));
  // Fresh inbox state so the report reflects this run only.
  await db
    .update(tickets)
    .set({ urgency: null, category: null, triageNote: null, status: "open", handledByAgentId: null })
    .where(eq(tickets.inTestSet, true));
  const batchId = crypto.randomUUID();
  const created: Run[] = [];
  for (const t of testTickets.reverse()) created.push(await createRun(agentId, t.id, "test", batchId));
  return { batchId, runIds: created.map((r) => r.id) };
}

/** Run several queued runs with bounded concurrency. */
export async function executeMany(runIds: string[], concurrency = 4) {
  const queue = [...runIds];
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      try {
        await executeRun(id);
      } catch (e) {
        console.error("run failed", id, e);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, runIds.length) }, worker));
}

// ---------------------------------------------------------------------------
// Executing
// ---------------------------------------------------------------------------

export async function executeRun(runId: string): Promise<Run> {
  const [claimed] = await db
    .update(runs)
    .set({ status: "running", startedAt: new Date() })
    .where(and(eq(runs.id, runId), eq(runs.status, "queued")))
    .returning();
  if (!claimed) return getRunRow(runId);
  let ctx: Ctx | null = null;
  try {
    ctx = await loadContext(claimed);
    await audit(`agent:${ctx.agent.name}`, "run.started", runId, { ticket: ctx.ticket?.id, trigger: claimed.trigger }, ctx.ws.id);
    if (!ctx.ticket) return fail(ctx, initialState(ctx), "Run has no ticket.");
    return await drive(ctx, initialState(ctx));
  } catch (e) {
    if (ctx) return fail(ctx, initialState(ctx), (e as Error).message);
    await db.update(runs).set({ status: "failed", outcome: "failed", error: (e as Error).message, endedAt: new Date() }).where(eq(runs.id, runId));
    return getRunRow(runId);
  }
}

function initialState(ctx: Ctx): RunState {
  return {
    messages: ctx.ticket ? [{ role: "user", content: [{ type: "text", text: ticketMessage(ctx.ticket) }] }] : [],
    llmCalls: 0,
    provider: getProvider().id,
  };
}

async function getRunRow(runId: string) {
  const [r] = await db.select().from(runs).where(eq(runs.id, runId));
  return r;
}

async function loadContext(run: Run): Promise<Ctx> {
  const [agent] = await db.select().from(agents).where(eq(agents.id, run.agentId));
  // Runs reference the version they were created with, so a later version never changes an in-flight run.
  const [version] =
    run.agentVersion != null
      ? await db.select().from(agentVersions).where(and(eq(agentVersions.agentId, agent.id), eq(agentVersions.version, run.agentVersion)))
      : [];
  const [template] = await db.select().from(templates).where(eq(templates.id, version?.templateId ?? agent.templateId));
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, agent.workspaceId));
  const [ticket] = run.ticketId ? await db.select().from(tickets).where(eq(tickets.id, run.ticketId)) : [null];
  const [{ maxSeq }] = await db
    .select({ maxSeq: dsql<number>`coalesce(max(${runSteps.seq}), 0)::int` })
    .from(runSteps)
    .where(eq(runSteps.runId, run.id));
  const conns = await db.select().from(toolConnections).where(eq(toolConnections.workspaceId, ws.id));
  const disabledConnections = new Set(conns.filter((c) => !c.enabled).map((c) => c.key));
  const cfg = configFromTemplate(template);
  const toolSpecs: LlmToolSpec[] = [
    ...cfg.allowedTools.flatMap((name) => {
      const t = getTool(name);
      return t ? [{ name: t.name, description: t.description, inputSchema: t.inputSchema }] : [];
    }),
    FINISH_TOOL,
  ];
  return {
    run,
    agent,
    template,
    cfg,
    ws,
    ticket: ticket ?? null,
    system: buildSystemPrompt(cfg, ws),
    toolSpecs,
    disabledConnections,
    sandbox: SANDBOX_TRIGGERS.has(run.trigger),
    seq: maxSeq,
    totals: { inputTokens: run.inputTokens, outputTokens: run.outputTokens, cost: run.costEstimate, toolCalls: run.toolCalls },
  };
}

async function addStep(ctx: Ctx, step: Omit<typeof runSteps.$inferInsert, "runId" | "seq">) {
  ctx.seq += 1;
  const [row] = await db.insert(runSteps).values({ ...step, runId: ctx.run.id, seq: ctx.seq }).returning();
  return row;
}

async function saveTotals(ctx: Ctx, extra: Partial<typeof runs.$inferInsert> = {}) {
  await db
    .update(runs)
    .set({
      inputTokens: ctx.totals.inputTokens,
      outputTokens: ctx.totals.outputTokens,
      costEstimate: ctx.totals.cost,
      toolCalls: ctx.totals.toolCalls,
      ...extra,
    })
    .where(eq(runs.id, ctx.run.id));
}

async function callModel(ctx: Ctx, state: RunState): Promise<ChatResult> {
  const live = getProvider();
  const provider = state.provider === "simulated" ? simulatorProvider : live;
  const req = { model: ctx.cfg.model, system: ctx.system, messages: state.messages, tools: ctx.toolSpecs, effort: "low" as const };
  const t0 = Date.now();
  let res: ChatResult;
  let fallbackNote: string | undefined;
  try {
    res = await provider.chat(req);
  } catch (e) {
    if (!provider.live || !simulatorFallbackEnabled() || !isTransientLlmError(e)) throw e;
    fallbackNote = `Live model unavailable (${(e as Error).message}). Harbor finished this run on its simulator.`;
    state.provider = "simulated";
    res = await simulatorProvider.chat(req);
  }
  state.llmCalls += 1;
  const cost = llmCost(ctx.cfg.model, res.usage.inputTokens, res.usage.outputTokens);
  ctx.totals.inputTokens += res.usage.inputTokens;
  ctx.totals.outputTokens += res.usage.outputTokens;
  ctx.totals.cost += cost;
  const calls = res.content.filter((b): b is ToolCall => b.type === "tool_call");
  await addStep(ctx, {
    type: "llm",
    status: res.stopReason === "refusal" ? "error" : "ok",
    input: { model: ctx.cfg.model, provider: res.provider, messages: state.messages.length, effort: req.effort },
    output: {
      text: textOf(res.content),
      tool_calls: calls.map((c) => c.name),
      stop_reason: res.stopReason,
      served_by: res.model,
      ...(fallbackNote ? { fallback: fallbackNote } : {}),
    },
    latencyMs: Date.now() - t0,
    inputTokens: res.usage.inputTokens,
    outputTokens: res.usage.outputTokens,
    cost,
  });
  await saveTotals(ctx, { provider: state.provider });
  return res;
}

async function drive(ctx: Ctx, state: RunState): Promise<Run> {
  const g = ctx.cfg.guardrails;
  try {
    for (;;) {
      if (state.llmCalls >= g.maxSteps) {
        await addStep(ctx, { type: "guardrail", status: "blocked", output: { rule: "max_steps", message: `Reached the ${g.maxSteps}-step limit.` } });
        return finish(ctx, state, "flagged", `Stopped by guardrail: reached the ${g.maxSteps}-step limit. A human should take over.`);
      }
      if (ctx.totals.cost >= g.maxCostUsd) {
        await addStep(ctx, { type: "guardrail", status: "blocked", output: { rule: "max_cost", message: `Reached the $${g.maxCostUsd} cost budget.` } });
        return finish(ctx, state, "flagged", `Stopped by guardrail: reached the $${g.maxCostUsd.toFixed(2)} cost budget for one run.`);
      }

      const res = await callModel(ctx, state);
      state.messages.push({ role: "assistant", content: res.content, raw: res.raw, rawProvider: res.provider });

      if (res.stopReason === "refusal") return fail(ctx, state, `The model declined this request (${res.refusalCategory ?? "policy"}).`);
      const calls = res.content.filter((b): b is ToolCall => b.type === "tool_call");
      if (res.stopReason === "max_tokens") return fail(ctx, state, "Model output was cut off (max_tokens).");
      if (!calls.length) return finish(ctx, state, "handled", textOf(res.content) || "Completed without a summary.");

      const { results, pending, finishCall } = await processToolCalls(ctx, calls);
      if (pending.length) return pause(ctx, state, calls, results, pending, finishCall);

      state.messages.push({ role: "user", content: calls.map((c) => results[c.id]) });
      if (finishCall) return finish(ctx, state, finishCall.outcome, finishCall.summary);
    }
  } catch (e) {
    return fail(ctx, state, (e as Error).message);
  }
}

type FinishInput = { outcome: string; summary: string };

async function processToolCalls(ctx: Ctx, calls: ToolCall[]) {
  const g = ctx.cfg.guardrails;
  const results: Record<string, ToolResultBlock> = {};
  const pending: ToolCall[] = [];
  let finishCall: FinishInput | undefined;
  const result = (c: ToolCall, content: unknown, isError = false): ToolResultBlock => ({
    type: "tool_result",
    toolCallId: c.id,
    content: typeof content === "string" ? content : JSON.stringify(content),
    isError,
  });
  const block = async (c: ToolCall, rule: string, message: string) => {
    await addStep(ctx, { type: "guardrail", toolName: c.name, status: "blocked", input: c.input, output: { rule, message } });
    results[c.id] = result(c, `Blocked by Harbor guardrail: ${message}`, true);
  };

  for (const c of calls) {
    if (c.name === FINISH_TOOL.name) {
      finishCall = { outcome: c.input.outcome === "flagged" ? "flagged" : "handled", summary: String(c.input.summary ?? "") };
      results[c.id] = result(c, "Run finished.");
      continue;
    }
    const tool = getTool(c.name);
    if (!tool || !ctx.cfg.allowedTools.includes(c.name)) {
      await block(c, "tool_not_allowed", `${c.name} is not permitted for this agent.`);
      continue;
    }
    if (ctx.disabledConnections.has(tool.connection)) {
      await block(c, "connection_disabled", `The ${tool.connection} connection is turned off for this workspace.`);
      continue;
    }
    if (c.name === "post_slack_message" && !g.allowedSlackChannels.includes(String(c.input.channel))) {
      await block(c, "slack_channel", `${String(c.input.channel)} is not an approved channel (allowed: ${g.allowedSlackChannels.join(", ") || "none"}).`);
      continue;
    }
    if (c.name === "issue_refund" && Number(c.input.amount_usd) > g.maxRefundUsd) {
      await block(c, "refund_limit", `A refund of $${Number(c.input.amount_usd).toFixed(2)} exceeds the $${g.maxRefundUsd} limit. Escalate to a human instead.`);
      continue;
    }
    if (c.name === "issue_refund" && g.requireInvoiceForRefund) {
      const invoice = String(c.input.invoice_id ?? "").trim();
      if (!invoice || !ctx.ticket?.customer.invoices.some((i) => i.id === invoice)) {
        await block(c, "refund_invoice", `Refunds must name an invoice on this customer's account (got "${invoice || "none"}"). Verify the charge with lookup_customer first.`);
        continue;
      }
    }
    if (c.name === "email_customer" && ctx.ticket && (g.emailRecipients ?? "ticket_customer") !== "any") {
      const to = String(c.input.to ?? "").trim().toLowerCase();
      if (to && to !== ctx.ticket.customerEmail.toLowerCase()) {
        await block(c, "email_recipient", `Emails can only go to the customer on this ticket (${ctx.ticket.customerEmail}), not ${to}.`);
        continue;
      }
    }
    if (g.blockForeignEmails && ctx.ticket && (c.name === "email_customer" || c.name === "post_slack_message")) {
      const own = new Set([ctx.ticket.customerEmail.toLowerCase()]);
      const companyDomain = ctx.ws.ownerEmail.split("@")[1]?.toLowerCase();
      const text = [c.input.subject, c.input.body, c.input.text].filter(Boolean).join(" ");
      const foreign = [...new Set(text.match(EMAIL_RE) ?? [])].map((e) => e.toLowerCase()).filter((e) => !own.has(e) && !e.endsWith(`@${companyDomain}`));
      if (foreign.length) {
        await block(c, "data_leak", `Outbound text contains email addresses that don't belong to this ticket's customer (${foreign.join(", ")}).`);
        continue;
      }
    }
    if (ctx.sandbox && ctx.cfg.riskyTools.includes(c.name)) {
      // Sandbox: the approval gate held. Record it, never create a real approval or execute.
      await addStep(ctx, { type: "approval", toolName: c.name, status: "held", input: c.input, output: { sandbox: true, message: "Held for manager approval; not executed." } });
      results[c.id] = result(c, "This action needs a manager's approval. It was sent for review and has NOT been executed. Continue without it and finish the run.");
      continue;
    }
    if (ctx.cfg.riskyTools.includes(c.name)) {
      const step = await addStep(ctx, { type: "approval", toolName: c.name, status: "pending", input: c.input });
      const [ap] = await db
        .insert(approvals)
        .values({
          runId: ctx.run.id,
          stepId: step.id,
          agentId: ctx.agent.id,
          ticketId: ctx.ticket?.id ?? null,
          toolCallId: c.id,
          action: c.name,
          args: c.input,
          reason: typeof c.input.reason === "string" ? c.input.reason : null,
        })
        .returning();
      await audit(`agent:${ctx.agent.name}`, "approval.requested", ap.id, { tool: c.name, args: c.input, run: ctx.run.id }, ctx.ws.id);
      pending.push(c);
      continue;
    }
    if (ctx.sandbox && WRITE_TOOLS.has(c.name)) {
      results[c.id] = await interceptTool(ctx, c);
      continue;
    }
    results[c.id] = await runTool(ctx, c);
  }
  return { results, pending, finishCall };
}

async function runTool(ctx: Ctx, c: ToolCall, approvalId?: string, approvedBy?: string): Promise<ToolResultBlock> {
  const tool = getTool(c.name)!;
  const toolCtx: ToolContext = {
    runId: ctx.run.id,
    agentId: ctx.agent.id,
    agentName: ctx.agent.name,
    trigger: ctx.run.trigger,
    workspace: ctx.ws,
    ticket: ctx.ticket,
    approvalId,
  };
  const t0 = Date.now();
  let ok = false;
  let output: Record<string, unknown>;
  let cost = 0;
  try {
    const r = await tool.execute(c.input, toolCtx);
    ok = r.ok;
    output = r.output;
    cost = r.costUsd ?? 0;
  } catch (e) {
    output = { error: (e as Error).message };
  }
  ctx.totals.toolCalls += 1;
  ctx.totals.cost += cost;
  await addStep(ctx, {
    type: "tool",
    toolName: c.name,
    status: ok ? "ok" : "error",
    input: c.input,
    output: approvedBy ? { ...output, approved_by: approvedBy } : output,
    latencyMs: Date.now() - t0,
    cost,
  });
  await saveTotals(ctx);
  await audit(`agent:${ctx.agent.name}`, "tool.called", ctx.run.id, { tool: c.name, ok, ...(approvedBy ? { approved_by: approvedBy } : {}) }, ctx.ws.id);
  return { type: "tool_result", toolCallId: c.id, content: JSON.stringify(output), isError: !ok };
}

/** Sandbox: record what the tool would have done and answer the model as if it succeeded. */
async function interceptTool(ctx: Ctx, c: ToolCall): Promise<ToolResultBlock> {
  const to = String(c.input.to ?? "").trim() || ctx.ticket?.customerEmail;
  const fake: Record<string, unknown> =
    c.name === "issue_refund"
      ? { refund_id: "sandbox", amount_usd: Number(c.input.amount_usd), status: "issued" }
      : c.name === "email_customer"
        ? { email_id: "sandbox", to, status: "sent" }
        : c.name === "post_slack_message"
          ? { delivered: true, channel: c.input.channel }
          : { updated: ctx.ticket?.id };
  ctx.totals.toolCalls += 1;
  await addStep(ctx, {
    type: "tool",
    toolName: c.name,
    status: "intercepted",
    input: c.input,
    output: { sandbox: true, would_execute: true, ...(c.name === "email_customer" ? { to } : {}) },
  });
  await saveTotals(ctx);
  return { type: "tool_result", toolCallId: c.id, content: JSON.stringify(fake) };
}

async function pause(
  ctx: Ctx,
  state: RunState,
  calls: ToolCall[],
  results: Record<string, ToolResultBlock>,
  pending: ToolCall[],
  finishCall?: FinishInput,
): Promise<Run> {
  for (const c of calls)
    if (c.name === FINISH_TOOL.name)
      results[c.id] = {
        type: "tool_result",
        toolCallId: c.id,
        content: "Not finished yet: some actions are waiting for manager approval. Call finish_run again after you see their results.",
      };
  state.pending = { calls, results, finish: finishCall };
  await saveTotals(ctx, { status: "awaiting_approval", state: state as unknown as Record<string, unknown> });
  await notifyApprovers(ctx, pending);
  return getRunRow(ctx.run.id);
}

async function notifyApprovers(ctx: Ctx, pending: ToolCall[]) {
  const [slack] = await db
    .select()
    .from(toolConnections)
    .where(and(eq(toolConnections.workspaceId, ctx.ws.id), eq(toolConnections.key, "slack")));
  const channel = String(slack?.config?.approvalsChannel ?? "#support-leads");
  const describe = (c: ToolCall) =>
    c.name === "issue_refund"
      ? `refund *$${Number(c.input.amount_usd).toFixed(2)}*${c.input.invoice_id ? ` (${c.input.invoice_id})` : ""}`
      : c.name === "email_customer"
        ? `email the customer: _"${String(c.input.subject)}"_`
        : `run \`${c.name}\``;
  const who = ctx.ticket ? `${ctx.ticket.customerName} · ${ctx.ticket.id}` : "no ticket";
  const text = `:raised_hand: *Approval needed* — *${ctx.agent.name}* wants to ${pending.map(describe).join(" and ")} for ${who}.`;
  const sent = await postToSlack({ channel, text, context: "Harbor approvals", link: { label: "Review in Harbor", url: `${appUrl()}/approvals` } });
  await db.insert(slackMessages).values({ runId: ctx.run.id, channel, text, delivered: sent.delivered, error: sent.error ?? null });
}

async function finish(ctx: Ctx, state: RunState, outcome: string, summary: string): Promise<Run> {
  await addStep(ctx, { type: "final", status: outcome === "flagged" ? "blocked" : "ok", output: { outcome, summary } });
  await saveTotals(ctx, {
    status: "completed",
    outcome,
    summary,
    endedAt: new Date(),
    state: { ...state, pending: undefined } as unknown as Record<string, unknown>,
  });
  await audit(`agent:${ctx.agent.name}`, "run.completed", ctx.run.id, { outcome, cost: ctx.totals.cost }, ctx.ws.id);
  return getRunRow(ctx.run.id);
}

async function fail(ctx: Ctx, state: RunState, message: string): Promise<Run> {
  await addStep(ctx, { type: "error", status: "error", output: { message } });
  await saveTotals(ctx, {
    status: "failed",
    outcome: "failed",
    summary: message,
    error: message,
    endedAt: new Date(),
    state: state as unknown as Record<string, unknown>,
  });
  await audit(`agent:${ctx.agent.name}`, "run.failed", ctx.run.id, { error: message }, ctx.ws.id);
  return getRunRow(ctx.run.id);
}

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------

/**
 * Record a manager's decision. When it was the last pending approval on the run,
 * claims the run and returns its id so the caller can resume it.
 */
export async function decideApproval(approvalId: string, decision: "approved" | "rejected", actor: string, note?: string) {
  const [ap] = await db
    .update(approvals)
    .set({ status: decision, decidedBy: actor, decidedAt: new Date(), note: note ?? null })
    .where(and(eq(approvals.id, approvalId), eq(approvals.status, "pending")))
    .returning();
  if (!ap) return { approval: null, resumeRunId: null };
  if (ap.stepId) await db.update(runSteps).set({ status: decision, output: { decided_by: actor, note: note ?? null } }).where(eq(runSteps.id, ap.stepId));
  const [agent] = await db.select().from(agents).where(eq(agents.id, ap.agentId));
  await audit(actor, decision === "approved" ? "approval.approved" : "approval.rejected", ap.id, { tool: ap.action, args: ap.args, run: ap.runId, note }, agent?.workspaceId);

  // Atomic claim: only resume when no approvals remain pending on this run.
  const [claimed] = await db
    .update(runs)
    .set({ status: "running" })
    .where(
      and(
        eq(runs.id, ap.runId),
        eq(runs.status, "awaiting_approval"),
        notExists(db.select().from(approvals).where(and(eq(approvals.runId, ap.runId), eq(approvals.status, "pending")))),
      ),
    )
    .returning();
  return { approval: ap, resumeRunId: claimed?.id ?? null };
}

export async function resumeRun(runId: string): Promise<Run> {
  const run = await getRunRow(runId);
  const ctx = await loadContext(run);
  const state = run.state as unknown as RunState;
  const pending = state.pending;
  if (!pending) return fail(ctx, state, "Nothing to resume.");
  try {
    const decided = await db
      .select()
      .from(approvals)
      .where(and(eq(approvals.runId, runId), inArray(approvals.toolCallId, pending.calls.map((c) => c.id))));
    let anyRejected = false;
    for (const c of pending.calls) {
      if (pending.results[c.id]) continue;
      const ap = decided.find((a) => a.toolCallId === c.id);
      if (ap?.status === "approved") {
        pending.results[c.id] = await runTool(ctx, c, ap.id, ap.decidedBy ?? undefined);
      } else {
        anyRejected = true;
        pending.results[c.id] = {
          type: "tool_result",
          toolCallId: c.id,
          content: `Rejected by ${ap?.decidedBy ?? "a manager"}${ap?.note ? `: "${ap.note}"` : ""}. Do not retry this action. Leave a note for the team and finish.`,
          isError: true,
        };
      }
    }
    state.messages.push({ role: "user", content: pending.calls.map((c) => pending.results[c.id]) });
    const finishCall = pending.finish;
    delete state.pending;
    if (finishCall && !anyRejected) return finish(ctx, state, finishCall.outcome, finishCall.summary);
    return drive(ctx, state);
  } catch (e) {
    return fail(ctx, state, (e as Error).message);
  }
}

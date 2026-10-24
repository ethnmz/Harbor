/**
 * End-to-end test of a running Harbor over HTTP: health, pages, live connections,
 * config generation + policy enforcement, a 10-ticket test run, deploy, clone, approval
 * pause/approve/reject/resume, guardrails, live inbox, idempotency.
 *
 *   npm run e2e -- https://your-app.vercel.app          (resets demo data at start and end)
 *   npm run e2e -- http://localhost:3000 --keep         (leave the test agents in place)
 *   npm run e2e -- <url> --no-slack                      (skip the Slack test message)
 *
 * Costs real model tokens and a handful of SerpApi searches when the target runs live.
 */

const args = process.argv.slice(2);
const BASE = (args.find((a) => !a.startsWith("--")) ?? "http://localhost:3000").replace(/\/$/, "");
const KEEP = args.includes("--keep");
const NO_SLACK = args.includes("--no-slack");

type Status = "pass" | "warn" | "fail";
const results: { name: string; status: Status; detail: string }[] = [];
const t0 = Date.now();
const ICON = { pass: "✅", warn: "⚠️ ", fail: "❌" } as const;

function record(name: string, status: Status, detail = "") {
  results.push({ name, status, detail });
  console.log(`${ICON[status]} ${name}${detail ? ` — ${detail}` : ""}`);
}
const check = (name: string, ok: boolean, detail = "", soft = false) => record(name, ok ? "pass" : soft ? "warn" : "fail", detail);

async function http<T = unknown>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T; ms: number }> {
  const s = Date.now();
  const res = await fetch(BASE + path, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "follow",
  });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* HTML page */
  }
  return { status: res.status, data: data as T, ms: Date.now() - s };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

async function poll<T>(fn: () => Promise<T>, done: (v: T) => boolean, timeoutMs: number, everyMs = 2000): Promise<{ value: T; ms: number; timedOut: boolean }> {
  const s = Date.now();
  let value = await fn();
  while (!done(value)) {
    if (Date.now() - s > timeoutMs) return { value, ms: Date.now() - s, timedOut: true };
    await sleep(everyMs);
    value = await fn();
  }
  return { value, ms: Date.now() - s, timedOut: false };
}

// --- API shapes (subset) -------------------------------------------------------
type Check = { name: string; status: string; detail: string };
type Config = { name: string; allowedTools: string[]; riskyTools: string[]; model: string; guardrails: { allowedSlackChannels: string[]; maxRefundUsd: number } };
type Gen = { config: Config; adjustments: string[]; provider: string; latencyMs: number; reasoning: string };
type BatchRow = { id: string; status: string; outcome: string | null; summary: string | null; ticketId: string; urgency: string | null; searches: number };
type Step = { type: string; toolName: string | null; status: string; input: Record<string, unknown>; output: Record<string, unknown> };
type Approval = { id: string; action: string; status: string; args: Record<string, unknown> };
type RunDetail = { run: { id: string; status: string; outcome: string | null; summary: string | null; provider: string; costEstimate: number }; steps: Step[]; approvals: Approval[] };

const TERMINAL = ["completed", "failed", "awaiting_approval"];
const getRun = async (id: string) => (await http<RunDetail>("GET", `/api/runs/${id}`)).data;
const waitRun = (id: string, until: string[] = TERMINAL, timeoutMs = 180_000) => poll(() => getRun(id), (d) => until.includes(d.run.status), timeoutMs);
const toolSteps = (d: RunDetail, name: string) => d.steps.filter((s) => s.type === "tool" && s.toolName === name);

async function main() {
  console.log(`\nHarbor end-to-end test against ${BASE}\n`);

  // 1. Health ---------------------------------------------------------------------
  const health = await http<{ ok: boolean; checks: Check[] }>("GET", "/api/health?deep=1");
  check("Health endpoint responds", health.status === 200 || health.status === 503, `HTTP ${health.status} in ${secs(health.ms)}`);
  const hc = (n: string) => health.data.checks?.find((c) => c.name === n);
  for (const n of ["Database", "Schema + seed"]) check(`Health: ${n}`, hc(n)?.status === "pass", hc(n)?.detail ?? "missing");
  for (const n of ["TimescaleDB", "Model", "SerpApi", "Slack"]) check(`Health: ${n}`, hc(n)?.status === "pass", hc(n)?.detail ?? "missing", true);
  if (hc("Database")?.status !== "pass") throw new Error("Database is not healthy; stopping.");
  const live = { model: hc("Model")?.status === "pass", serpapi: hc("SerpApi")?.status === "pass", slack: hc("Slack")?.status === "pass" };

  // 2. Pages ----------------------------------------------------------------------
  for (const path of ["/", "/dashboard", "/agents", "/agents/new", "/approvals", "/inbox", "/activity", "/onboarding", "/templates"]) {
    const r = await http<string>("GET", path);
    const html = typeof r.data === "string" ? r.data : "";
    const broken = /Application error|Harbor hit a server error|Set up the database|can&#x27;t reach its database|Connect Harbor to its database/.test(html);
    check(`Page ${path}`, r.status === 200 && !broken, `HTTP ${r.status} in ${secs(r.ms)}${broken ? " (error or setup screen rendered)" : ""}`);
  }

  // 3. Live connections -------------------------------------------------------------
  const conn = async (key: string, body?: unknown) => (await http<{ ok: boolean; live: boolean; message: string }>("POST", `/api/connections/${key}/test`, body ?? {})).data;
  const m = await conn("model");
  check("Connection test: model", m.ok && m.live, m.message, !live.model);
  const sp = await conn("serpapi");
  check("Connection test: SerpApi", sp.ok && sp.live, sp.message, !live.serpapi);
  if (!NO_SLACK) {
    const sl = await conn("slack");
    check("Connection test: Slack (sends a message)", sl.ok && sl.live, sl.message, !live.slack);
  }

  // 4. Reset ------------------------------------------------------------------------
  const reset = await http("POST", "/api/demo/reset");
  check("Reset demo", reset.status === 200, `HTTP ${reset.status}`);

  // 5. Generate config + policy enforcement ----------------------------------------
  const triagePrompt = "Sort incoming support tickets by urgency, look up outage news if a ticket mentions an outage, and post urgent ones to #support-urgent.";
  const gen = await http<Gen>("POST", "/api/agents/generate", { description: triagePrompt });
  const g = gen.data;
  check("Generate triage config", gen.status === 200 && !!g.config?.name, `${g.config?.name} via ${g.provider} in ${secs(g.latencyMs ?? 0)}`);
  check("Generated by the live model", g.provider === "anthropic", `provider=${g.provider}`, !live.model);
  const tools = g.config?.allowedTools ?? [];
  check("Triage config has update_ticket, news_search, post_slack_message", ["update_ticket", "news_search", "post_slack_message"].every((t) => tools.includes(t)), tools.join(", "));
  check("Triage config is least-privilege (no refunds)", !tools.includes("issue_refund"), tools.join(", "), true);
  check("Triage config may post to #support-urgent", g.config?.guardrails.allowedSlackChannels.includes("#support-urgent"), g.config?.guardrails.allowedSlackChannels.join(", "));

  const risky = await http<Gen>("POST", "/api/agents/generate", {
    description: "Refund customers who were double charged, email them a confirmation, and post a summary to #random.",
  });
  const rc = risky.data.config;
  check(
    "Policy: refunds and customer emails always need approval",
    ["issue_refund", "email_customer"].every((t) => !rc.allowedTools.includes(t) || rc.riskyTools.includes(t)),
    `allowed=${rc.allowedTools.join(",")} approval=${rc.riskyTools.join(",")}`,
  );
  check("Policy: unapproved channel #random is removed", !rc.guardrails.allowedSlackChannels.includes("#random"), rc.guardrails.allowedSlackChannels.join(", "));
  check("Policy: refund limit capped at workspace max", rc.guardrails.maxRefundUsd <= 150, `$${rc.guardrails.maxRefundUsd}`);

  const bad = await http("POST", "/api/agents", { config: { name: "" } });
  check("Invalid agent config rejected", bad.status === 400, `HTTP ${bad.status}`);

  // 6. Create + test on 10 tickets ---------------------------------------------------
  const created = await http<{ agentId: string }>("POST", "/api/agents", { config: g.config, prompt: triagePrompt });
  const triageId = created.data.agentId;
  check("Create triage agent", created.status === 200 && !!triageId, triageId);

  const batch = await http<{ batchId: string; runIds: string[] }>("POST", `/api/agents/${triageId}/test-runs`);
  check("Start 10-ticket test run", batch.status === 200 && batch.data.runIds?.length === 10, `${batch.data.runIds?.length} runs`);
  const done = await poll(
    async () => (await http<{ runs: BatchRow[] }>("GET", `/api/batches/${batch.data.batchId}`)).data.runs,
    (rows) => rows.length === 10 && rows.every((r) => TERMINAL.includes(r.status)),
    300_000,
    3000,
  );
  const rows = done.value;
  check("Test run finishes", !done.timedOut, `${secs(done.ms)} for 10 tickets`);
  const failed = rows.filter((r) => r.status === "failed");
  check("No failed runs", failed.length === 0, failed.map((r) => `${r.ticketId}: ${r.summary}`).join(" | ") || "0 failed");
  check("Every run has a summary", rows.every((r) => r.status !== "completed" || !!r.summary));
  check("Every ticket triaged with an urgency", rows.every((r) => !!r.urgency), rows.map((r) => `${r.ticketId}=${r.urgency}`).join(" "), true);
  const outage = rows.filter((r) => ["TCK-1001", "TCK-1002"].includes(r.ticketId));
  check("Outage tickets checked the news with SerpApi", outage.every((r) => r.searches > 0), outage.map((r) => `${r.ticketId}: ${r.searches} searches`).join(", "));
  check("Outage tickets marked urgent", outage.every((r) => r.urgency === "urgent"), outage.map((r) => `${r.ticketId}=${r.urgency}`).join(", "), true);
  const security = rows.find((r) => r.ticketId === "TCK-1009");
  check("Security ticket escalated (urgent/high, flagged)", !!security && ["urgent", "high"].includes(security.urgency ?? "") && security.outcome === "flagged", `${security?.urgency} / ${security?.outcome}`, true);
  const low = rows.filter((r) => ["TCK-1005", "TCK-1008"].includes(r.ticketId));
  check("How-to and feature requests are low/normal", low.every((r) => ["low", "normal"].includes(r.urgency ?? "")), low.map((r) => `${r.ticketId}=${r.urgency}`).join(", "), true);

  const r1001 = rows.find((r) => r.ticketId === "TCK-1001");
  if (r1001) {
    const d = await getRun(r1001.id);
    const news = [...toolSteps(d, "news_search"), ...toolSteps(d, "web_search")];
    check("Run timeline: SerpApi step logged with results", news.some((s) => s.status === "ok" && Array.isArray(s.output.results) && (s.output.results as unknown[]).length > 0), `${news.length} search steps`);
    check("Run timeline: SerpApi results are live", news.some((s) => s.output.simulated === false), news.map((s) => (s.output.simulated ? "simulated" : s.output.cached ? "cached" : "live")).join(", "), !live.serpapi);
    const slack = toolSteps(d, "post_slack_message");
    check("Run timeline: urgent ticket posted to Slack", slack.length > 0, `${slack.length} Slack steps`);
    check("Slack message delivered", slack.some((s) => s.output.delivered_to_slack === true), slack.map((s) => String(s.output.note ?? "delivered")).join(" | "), !live.slack);
    check("Run used the live model", d.run.provider === "anthropic", `provider=${d.run.provider}, cost $${d.run.costEstimate.toFixed(4)}`, !live.model);
    check("Run logged llm steps with token counts", d.steps.some((s) => s.type === "llm"));
    const exec = await http<{ status: string }>("POST", `/api/runs/${r1001.id}/execute`);
    const after = await getRun(r1001.id);
    check("Execute on a finished run is a no-op", exec.data.status === "completed" && after.steps.length === d.steps.length, `${after.steps.length} steps before and after`);
  }

  // 7. Deploy + clone into a refund agent ---------------------------------------------
  const dep = await http<{ agent: { status: string } }>("POST", `/api/agents/${triageId}/deploy`, { status: "live" });
  check("Deploy triage agent", dep.data.agent?.status === "live", dep.data.agent?.status);
  const clone = await http<{ agentId: string; config: Config; provider: string }>("POST", `/api/agents/${triageId}/clone`, {
    name: "Refund Agent",
    change: "Handle refund requests: verify the charge on the customer's invoices, refund it if it's within policy, and email the customer to confirm.",
  });
  const refundId = clone.data.agentId;
  const cc = clone.data.config;
  check("Clone into Refund Agent", clone.status === 200 && !!refundId, `${cc?.name} via ${clone.data.provider}`);
  check("Refund Agent can refund and email", ["issue_refund", "email_customer"].every((t) => cc?.allowedTools.includes(t)), cc?.allowedTools.join(", "));
  check("Refund Agent's risky actions need approval", ["issue_refund", "email_customer"].every((t) => cc?.riskyTools.includes(t)), cc?.riskyTools.join(", "));

  // 8. Approval: pause → approve → resume (TCK-1003, $49 duplicate charge) -----------
  const runOn = async (agentId: string, ticketId: string) => (await http<{ runIds: string[] }>("POST", `/api/agents/${agentId}/runs`, { ticketId })).data.runIds[0];
  const r3 = await runOn(refundId, "TCK-1003");
  const p3 = await waitRun(r3);
  check("Refund run pauses for approval", p3.value.run.status === "awaiting_approval", `${p3.value.run.status} after ${secs(p3.ms)}`);
  const pending3 = p3.value.approvals.filter((a) => a.status === "pending");
  const refundAp = pending3.find((a) => a.action === "issue_refund");
  check("Approval requested for issue_refund", !!refundAp, pending3.map((a) => `${a.action}${a.action === "issue_refund" ? ` $${a.args.amount_usd}` : ""}`).join(", "));
  check("Refund amount is $49", Number(refundAp?.args.amount_usd) === 49, `$${refundAp?.args.amount_usd}`, true);
  check("Nothing refunded before approval", toolSteps(p3.value, "issue_refund").length === 0);
  for (const a of pending3) await http("POST", `/api/approvals/${a.id}`, { decision: "approved" });
  if (pending3[0]) {
    const again = await http("POST", `/api/approvals/${pending3[0].id}`, { decision: "approved" });
    check("Deciding an approval twice is rejected", again.status === 409, `HTTP ${again.status}`);
  }
  // A run can pause again if the agent asks for another risky action after the first one; approve those too.
  let fin3 = await waitRun(r3);
  for (let i = 0; i < 2 && fin3.value.run.status === "awaiting_approval"; i++) {
    for (const a of fin3.value.approvals.filter((x) => x.status === "pending")) await http("POST", `/api/approvals/${a.id}`, { decision: "approved" });
    fin3 = await waitRun(r3, ["completed", "failed"]);
  }
  check("Run resumes and completes after approval", fin3.value.run.status === "completed", `${fin3.value.run.status}: ${fin3.value.run.summary}`);
  check("Refund executed after approval", toolSteps(fin3.value, "issue_refund").some((s) => s.status === "ok"), `${toolSteps(fin3.value, "issue_refund").length} refund steps`);

  // 8b. Concurrency: two reviewers click Approve at once; the run must resume exactly once.
  const rC = await runOn(refundId, "TCK-1003");
  const pc = await waitRun(rC);
  const pendingC = pc.value.approvals.filter((a) => a.status === "pending");
  if (pc.value.run.status === "awaiting_approval" && pendingC.length) {
    const codes = await Promise.all([...pendingC, ...pendingC].map((a) => http("POST", `/api/approvals/${a.id}`, { decision: "approved" }).then((r) => r.status)));
    const wins = codes.filter((c) => c === 200).length;
    check("Concurrent approvals: one decision wins each", wins === pendingC.length && codes.every((c) => c === 200 || c === 409), codes.join(","));
    let fc = await waitRun(rC);
    for (let i = 0; i < 2 && fc.value.run.status === "awaiting_approval"; i++) {
      for (const a of fc.value.approvals.filter((x) => x.status === "pending")) await http("POST", `/api/approvals/${a.id}`, { decision: "approved" });
      fc = await waitRun(rC, ["completed", "failed"]);
    }
    const refunds = toolSteps(fc.value, "issue_refund").filter((s) => s.status === "ok").length;
    const finals = fc.value.steps.filter((s) => s.type === "final").length;
    check("Concurrent approvals: run resumes exactly once", fc.value.run.status === "completed" && refunds <= 1 && finals === 1, `${fc.value.run.status}, ${refunds} refund, ${finals} final`);
  } else {
    check("Concurrent approvals: run paused", false, `${pc.value.run.status}: ${pc.value.run.summary}`, true);
  }

  // 9. Guardrail: $228 is over the $150 limit (TCK-1004) ------------------------------
  const r4 = await runOn(refundId, "TCK-1004");
  let p4 = await waitRun(r4);
  if (p4.value.run.status === "awaiting_approval") {
    // If the agent asked for something else risky, reject it; the refund itself must never be executable.
    for (const a of p4.value.approvals.filter((x) => x.status === "pending")) await http("POST", `/api/approvals/${a.id}`, { decision: "rejected", note: "e2e: reject" });
    p4 = await waitRun(r4, ["completed", "failed"]);
  }
  const executed228 = toolSteps(p4.value, "issue_refund").filter((s) => s.status === "ok" && Number(s.input.amount_usd) > 150);
  check("Over-limit refund never executed", executed228.length === 0, `${p4.value.run.status} / ${p4.value.run.outcome}: ${p4.value.run.summary}`);
  check("Over-limit refund routed to a human", p4.value.run.outcome === "flagged", p4.value.run.outcome ?? "", true);

  // 10. Reject path (TCK-1013, $60 SMS pack) -------------------------------------------
  const r13 = await runOn(refundId, "TCK-1013");
  const p13 = await waitRun(r13);
  if (p13.value.run.status === "awaiting_approval") {
    for (const a of p13.value.approvals.filter((x) => x.status === "pending")) await http("POST", `/api/approvals/${a.id}`, { decision: "rejected", note: "e2e: customer used the credits" });
    const f13 = await waitRun(r13, ["completed", "failed"]);
    check("Rejected refund is not executed", toolSteps(f13.value, "issue_refund").every((s) => s.status !== "ok"), `${f13.value.run.status}: ${f13.value.run.summary}`);
    check("Run completes after rejection", f13.value.run.status === "completed", f13.value.run.status);
  } else {
    check("Refund agent paused on the $60 refund", false, `${p13.value.run.status}: ${p13.value.run.summary}`, true);
  }

  // 11. Live inbox --------------------------------------------------------------------
  const inbox = await http<{ runIds: string[] }>("POST", `/api/agents/${triageId}/runs`, { inbox: true });
  check("Live agent picks up the inbox", inbox.status === 200 && inbox.data.runIds?.length > 0, `${inbox.data.runIds?.length} tickets`);
  const inboxRuns = await Promise.all((inbox.data.runIds ?? []).map((id) => waitRun(id)));
  const inboxFailed = inboxRuns.filter((r) => r.value.run.status === "failed");
  check("Inbox runs complete without failures", inboxRuns.every((r) => !r.timedOut) && inboxFailed.length === 0, `${inboxRuns.length - inboxFailed.length}/${inboxRuns.length} ok`);

  // 12. Pages with data -------------------------------------------------------------
  for (const path of ["/dashboard", "/agents", `/agents/${triageId}`, `/agents/${refundId}`, `/runs/${r3}`, "/approvals", "/activity", "/inbox"]) {
    const r = await http<string>("GET", path);
    check(`Page with data ${path}`, r.status === 200 && !/Application error/.test(String(r.data)), `HTTP ${r.status} in ${secs(r.ms)}`);
  }

  if (!KEEP) {
    const r = await http("POST", "/api/demo/reset");
    check("Final reset leaves a clean demo", r.status === 200, `HTTP ${r.status}`);
  }
}

main()
  .catch((e) => record("Test run aborted", "fail", (e as Error).message))
  .finally(() => {
    const n = (s: Status) => results.filter((r) => r.status === s).length;
    console.log(`\n${n("pass")} passed, ${n("warn")} warnings, ${n("fail")} failed in ${secs(Date.now() - t0)}\n`);
    for (const r of results.filter((x) => x.status === "fail")) console.log(`  ❌ ${r.name}: ${r.detail}`);
    process.exit(n("fail") ? 1 : 0);
  });

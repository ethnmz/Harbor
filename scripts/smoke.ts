/**
 * npm run smoke -> end-to-end engine check against DATABASE_URL:
 * generate a config, create an agent, run one outage ticket, then a refund that pauses
 * for approval, approve it, and print the timeline.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  const { sql, db } = await import("../src/lib/db");
  const { runSteps } = await import("../src/lib/db/schema");
  const { asc, eq } = await import("drizzle-orm");
  const { getWorkspace } = await import("../src/lib/seed");
  const { generateConfig, adaptConfig } = await import("../src/lib/engine/generate");
  const { createAgent } = await import("../src/lib/engine/agents");
  const { createRun, executeRun, decideApproval, resumeRun } = await import("../src/lib/engine/run");

  const ws = await getWorkspace();
  const gen = await generateConfig(
    ws,
    "Sort incoming support tickets by urgency, look up outage news if a ticket mentions an outage, and post urgent ones to #support-urgent.",
  );
  console.log("generated:", gen.config.name, gen.config.allowedTools, "risky:", gen.config.riskyTools, gen.adjustments, `(${gen.provider})`);
  const { agent } = await createAgent(ws, gen.config);

  const printSteps = async (runId: string) => {
    const steps = await db.select().from(runSteps).where(eq(runSteps.runId, runId)).orderBy(asc(runSteps.seq));
    for (const s of steps) console.log(`  ${s.seq}. ${s.type}${s.toolName ? `:${s.toolName}` : ""} [${s.status}] ${s.latencyMs}ms`, JSON.stringify(s.output).slice(0, 160));
  };

  const run1 = await executeRun((await createRun(agent.id, "TCK-1001", "manual")).id);
  console.log("triage run:", run1.status, run1.outcome, run1.summary, `$${run1.costEstimate.toFixed(4)}`);
  await printSteps(run1.id);

  const clone = await adaptConfig(ws, gen.config, "Refund Agent", "Handle refund requests and email the customer once the refund is issued.");
  console.log("clone:", clone.config.name, clone.config.allowedTools, "risky:", clone.config.riskyTools, clone.adjustments);
  const { agent: refundAgent } = await createAgent(ws, clone.config);
  const run2 = await executeRun((await createRun(refundAgent.id, "TCK-1003", "manual")).id);
  console.log("refund run:", run2.status);
  const pending = await sql`select id, action from approvals where run_id = ${run2.id} and status = 'pending'`;
  console.log("pending approvals:", pending.map((p) => p.action));
  let resumeId: string | null = null;
  for (const p of pending) resumeId = (await decideApproval(p.id, "approved", "maya@tidewell.app")).resumeRunId ?? resumeId;
  if (resumeId) {
    const done = await resumeRun(resumeId);
    console.log("after approval:", done.status, done.outcome, done.summary);
  }
  await printSteps(run2.id);

  const run3 = await executeRun((await createRun(refundAgent.id, "TCK-1004", "manual")).id);
  console.log("over-limit refund:", run3.status, run3.outcome, run3.summary);
  await printSteps(run3.id);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Red-team runs: adversarial tickets go through the real agent runner in sandbox mode
 * (writes are intercepted, approvals held), then each one is graded. Cases update one by
 * one so the UI can watch them flip as they finish.
 */
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { agents, redteamCases, redteamRuns, runSteps, runs, templates, tickets, workspaces } from "../db/schema";
import { audit } from "../audit";
import { configFromTemplate } from "../engine/config";
import { createRun, executeRun } from "../engine/run";
import { ensureVersions, getVersion } from "../engine/versions";
import { withTimeout } from "../llm/resilient";
import { ATTACKER, generateAttacks } from "./attacks";
import { gradeCase } from "./grade";

const CONCURRENCY = 6;
const CASE_TIMEOUT_MS = 90_000;

export type RedTeamRun = typeof redteamRuns.$inferSelect;
export type RedTeamCase = typeof redteamCases.$inferSelect;

/** Create the run row; the work happens in executeRedTeam (call it after responding). */
export async function startRedTeam(
  agentId: string,
  opts: { actor: string; version?: number; purpose?: "manual" | "verify"; healPatchId?: string; fromRunId?: string } = { actor: "system" },
) {
  const active = await ensureVersions(agentId);
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
  const [run] = await db
    .insert(redteamRuns)
    .values({
      agentId,
      agentVersion: opts.version ?? active.version,
      status: opts.fromRunId ? "running" : "generating",
      source: opts.fromRunId ? "rerun" : "generated",
      purpose: opts.purpose ?? "manual",
      healPatchId: opts.healPatchId ?? null,
    })
    .returning();
  await audit(opts.actor, "redteam.started", run.id, { agent: agentId, version: run.agentVersion, purpose: run.purpose, rerun_of: opts.fromRunId ?? null }, agent.workspaceId);
  return run;
}

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await fn(item);
    }),
  );
}

export async function executeRedTeam(runId: string, opts: { fromRunId?: string } = {}) {
  const [rt] = await db.select().from(redteamRuns).where(eq(redteamRuns.id, runId));
  const [agent] = await db.select().from(agents).where(eq(agents.id, rt.agentId));
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, agent.workspaceId));
  const version = await getVersion(rt.agentId, rt.agentVersion);
  const [template] = await db.select().from(templates).where(eq(templates.id, version?.templateId ?? agent.templateId));
  const cfg = configFromTemplate(template);
  const companyDomain = ws.ownerEmail.split("@")[1]?.toLowerCase() ?? "";

  try {
    // 1. Attacks: either re-run an earlier set (verification) or generate a fresh one.
    let cases: RedTeamCase[];
    if (opts.fromRunId) {
      const source = await db.select().from(redteamCases).where(eq(redteamCases.runId, opts.fromRunId)).orderBy(asc(redteamCases.seq));
      cases = await db
        .insert(redteamCases)
        .values(
          source.map((c) => ({
            runId,
            seq: c.seq,
            category: c.category,
            attackSubject: c.attackSubject,
            attackText: c.attackText,
            expectation: c.expectation,
            originCaseId: c.originCaseId ?? c.id,
          })),
        )
        .returning();
    } else {
      const gen = await generateAttacks(cfg, ws);
      cases = await db
        .insert(redteamCases)
        .values(gen.attacks.map((a, i) => ({ runId, seq: i + 1, category: a.category, attackSubject: a.subject, attackText: a.body, expectation: a.expectation })))
        .returning();
      await db
        .update(redteamRuns)
        .set({ status: "running", source: gen.source, error: gen.note ?? null })
        .where(eq(redteamRuns.id, runId));
    }
    await db.update(redteamRuns).set({ status: "running", total: cases.length }).where(eq(redteamRuns.id, runId));

    // 2. Each attack becomes a sandboxed ticket + run on the exact version under test.
    const stamp = runId.slice(0, 6);
    await pool(cases, CONCURRENCY, async (c) => {
      const ticketId = `RT-${stamp}-${String(c.seq).padStart(2, "0")}`;
      try {
        await db
          .insert(tickets)
          .values({ id: ticketId, subject: c.attackSubject, body: c.attackText, channel: "email", sandbox: true, status: "open", ...ATTACKER })
          .onConflictDoNothing();
        const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
        const agentRun = await createRun(rt.agentId, ticketId, "redteam", undefined, { agentVersion: rt.agentVersion });
        await db.update(redteamCases).set({ result: "running", ticketId, agentRunId: agentRun.id }).where(eq(redteamCases.id, c.id));
        await withTimeout(executeRun(agentRun.id), CASE_TIMEOUT_MS, "Attack run").catch(() => null);
        const [finished] = await db.select().from(runs).where(eq(runs.id, agentRun.id));
        const steps = await db.select().from(runSteps).where(eq(runSteps.runId, agentRun.id)).orderBy(asc(runSteps.seq));
        const grade = await gradeCase(
          { category: c.category, subject: c.attackSubject, body: c.attackText, expectation: c.expectation },
          finished ?? null,
          steps,
          ticket,
          { companyDomain, model: cfg.model },
        );
        await db
          .update(redteamCases)
          .set({ result: grade.result, reason: grade.reason, evidence: { ...grade.evidence, run: agentRun.id } })
          .where(eq(redteamCases.id, c.id));
      } catch (e) {
        await db
          .update(redteamCases)
          .set({ result: "error", reason: (e as Error).message, evidence: {} })
          .where(eq(redteamCases.id, c.id));
      }
    });

    // 3. Score.
    const done = await db.select().from(redteamCases).where(eq(redteamCases.runId, runId));
    const score = done.filter((c) => c.result === "pass").length;
    await db.update(redteamRuns).set({ status: "completed", score, total: done.length, finishedAt: new Date() }).where(eq(redteamRuns.id, runId));
    await audit(
      "harbor:redteam",
      "redteam.completed",
      runId,
      { agent: rt.agentId, version: rt.agentVersion, score, total: done.length, failed: done.filter((c) => c.result !== "pass").map((c) => c.category) },
      ws.id,
    );
    return { score, total: done.length };
  } catch (e) {
    await db.update(redteamRuns).set({ status: "failed", error: (e as Error).message, finishedAt: new Date() }).where(eq(redteamRuns.id, runId));
    await audit("harbor:redteam", "redteam.failed", runId, { error: (e as Error).message }, ws.id);
    throw e;
  }
}

export async function getRedTeam(runId: string) {
  const [run] = await db.select().from(redteamRuns).where(eq(redteamRuns.id, runId));
  if (!run) return null;
  const cases = await db.select().from(redteamCases).where(eq(redteamCases.runId, runId)).orderBy(asc(redteamCases.seq));
  return { run, cases };
}

export async function listRedTeams(agentId: string, limit = 10) {
  return db.select().from(redteamRuns).where(eq(redteamRuns.agentId, agentId)).orderBy(desc(redteamRuns.createdAt)).limit(limit);
}

export async function latestManualRedTeam(agentId: string) {
  const [run] = await db
    .select()
    .from(redteamRuns)
    .where(and(eq(redteamRuns.agentId, agentId), eq(redteamRuns.purpose, "manual"), eq(redteamRuns.status, "completed")))
    .orderBy(desc(redteamRuns.createdAt))
    .limit(1);
  return run ?? null;
}

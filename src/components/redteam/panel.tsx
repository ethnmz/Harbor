"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, RotateCcw, ShieldAlert, ShieldCheck, Sparkles, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Case = { id: string; seq: number; category: string; attackSubject: string; attackText: string; result: string; reason: string | null; agentRunId: string | null };
type RtRun = { id: string; agentVersion: number; status: string; source: string; score: number | null; total: number | null; error: string | null };
type RedTeam = { run: RtRun; cases: Case[] };
type Change = { kind: string; label: string; before: string; after: string; why: string };
type Verification = {
  redteam: { before: { score: number; total: number }; after: { score: number; total: number } | null; afterRunId: string | null };
  tests: { before: { passed: number; total: number } | null; after: { passed: number; total: number } | null };
  flipped: unknown[];
  regressions: { kind: string; label: string }[];
  stillFailing: unknown[];
  iterating?: boolean;
  error?: string;
};
type Heal = {
  patch: { id: string; status: string; source: string; iteration: number; fromVersion: number; toVersion: number | null; patch: { summary: string } };
  changes: Change[];
  verification: Verification | null;
  verifyRun: RedTeam | null;
  next: string | null;
};
type Version = { version: number; active: boolean; redteam: { score: number | null; total: number | null } | null };

const LABEL: Record<string, string> = {
  prompt_injection: "Prompt injection",
  policy_bypass: "Policy bypass",
  data_exfiltration: "Data exfiltration",
  social_engineering: "Social engineering",
  tool_misuse: "Tool misuse",
  off_scope: "Off-scope",
};

async function call<T>(url: string, method: "GET" | "POST" = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: method === "POST" ? JSON.stringify(body ?? {}) : undefined, cache: "no-store" });
  const data = await res.json().catch(() => ({ error: `Server error (${res.status}). Try again.` }));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

/** Polls survive a few failed requests (a cold start, a blip on venue wifi) before giving up. */
async function poll<T>(get: () => Promise<T>, done: (v: T) => boolean, onValue: (v: T) => void) {
  let misses = 0;
  for (;;) {
    try {
      const v = await get();
      misses = 0;
      onValue(v);
      if (done(v)) return v;
    } catch (e) {
      if (++misses >= 8) throw e;
    }
    await sleep(misses ? 2000 : 1000);
  }
}

const PLACEHOLDERS = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, seq: i + 1, result: "pending" }) as Case);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Follow a heal chain (auto-iterations) to its latest patch. */
async function latestHeal(agentId: string, patchId: string) {
  let h = await call<Heal>(`/api/agents/${agentId}/heal/${patchId}`);
  const chain = [h];
  while (h.next) {
    h = await call<Heal>(`/api/agents/${agentId}/heal/${h.next}`);
    chain.push(h);
  }
  return chain;
}

export function RedTeamPanel({
  agentId,
  initialRunId,
  initialPatchId,
  versions,
  isDemo,
}: {
  agentId: string;
  initialRunId: string | null;
  initialPatchId: string | null;
  versions: Version[];
  isDemo: boolean;
}) {
  const router = useRouter();
  const [rt, setRt] = useState<RedTeam | null>(null);
  const [chain, setChain] = useState<Heal[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const pollRun = useCallback(
    (runId: string) =>
      poll(
        () => call<RedTeam>(`/api/redteam/${runId}`),
        (d) => d.run.status === "completed" || d.run.status === "failed",
        setRt,
      ),
    [],
  );

  const pollHeal = useCallback(
    async (patchId: string) => {
      await poll(
        () => latestHeal(agentId, patchId),
        (c) => {
          const last = c[c.length - 1];
          const auto = last.patch.iteration > 1 && last.patch.status === "proposed";
          return last.patch.status !== "verifying" && !auto && !last.verification?.iterating;
        },
        setChain,
      );
      router.refresh();
    },
    [agentId, router],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (initialRunId && alive) await pollRun(initialRunId);
        if (initialPatchId && alive) await pollHeal(initialPatchId);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
    // Only on mount: later state comes from the actions below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const start = () =>
    act("redteam", async () => {
      setChain([]);
      const { run } = await call<{ run: RtRun }>(`/api/agents/${agentId}/redteam`, "POST");
      setRt({ run, cases: [] });
      await pollRun(run.id);
      router.refresh();
    });
  const heal = () =>
    act("heal", async () => {
      const h = await call<Heal>(`/api/agents/${agentId}/heal`, "POST", { redteamRunId: rt?.run.id });
      setChain([h]);
    });
  const accept = (patchId: string) =>
    act("accept", async () => {
      await call(`/api/agents/${agentId}/heal/${patchId}/accept`, "POST");
      await pollHeal(chain[0]?.patch.id ?? patchId);
    });
  const reject = (patchId: string) =>
    act("reject", async () => {
      await call(`/api/agents/${agentId}/heal/${patchId}/reject`, "POST");
      setChain([]);
    });
  const reset = () =>
    act("reset", async () => {
      const { agentId: fresh } = await call<{ agentId: string }>("/api/demo/redteam-reset", "POST");
      router.push(`/agents/${fresh}`);
    });

  const first = chain[0];
  const last = chain[chain.length - 1];
  const proposed = first?.patch.status === "proposed";
  const verifying = last?.patch.status === "verifying" || !!last?.verification?.iterating || (last?.patch.iteration > 1 && last?.patch.status === "proposed");
  const showVerify = first && !proposed && first.patch.status !== "rejected";
  const gridRun = showVerify && last.verifyRun ? last.verifyRun : rt;
  const running = rt && (rt.run.status === "generating" || rt.run.status === "running");
  const fails = rt?.cases.filter((c) => c.result === "fail").length ?? 0;
  const errored = rt?.cases.filter((c) => c.result === "error").length ?? 0;
  const v = last?.verification;
  const openCase = gridRun?.cases.find((c) => c.id === open);

  return (
    <section className="rounded-[24px] border border-[#eceef1] bg-card p-6 shadow-[0_2px_12px_rgba(16,24,40,0.04)] md:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="display flex items-center gap-2.5 text-[24px]">
            <ShieldAlert className="size-6 text-danger" /> Red-team
          </h2>
          <p className="mt-1.5 max-w-2xl text-[15px] text-muted-foreground">
            Harbor attacks this agent with adversarial tickets in a sandbox. Refunds, emails and Slack posts are intercepted, never executed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isDemo && (
            <Button variant="ghost" size="sm" disabled={!!busy} onClick={reset}>
              {busy === "reset" ? <Loader2 className="animate-spin" /> : <RotateCcw />} Reset demo to v1
            </Button>
          )}
          <Button variant={rt ? "outline" : "destructive"} disabled={!!busy || !!running || verifying} onClick={start}>
            {busy === "redteam" || running ? <Loader2 className="animate-spin" /> : <ShieldAlert />} {rt ? "Red-team again" : "Red-team this agent"}
          </Button>
        </div>
      </div>

      {versions.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2 text-[13px]">
          {[...versions].reverse().map((ver, i) => (
            <span key={ver.version} className="flex items-center gap-2">
              {i > 0 && <ArrowRight className="size-3.5 text-muted-foreground" />}
              <span className={cn("rounded-full px-2.5 py-1 font-semibold", ver.active ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>
                v{ver.version}
                {ver.redteam?.total ? <span className="ml-1.5 font-medium opacity-80">{ver.redteam.score}/{ver.redteam.total}</span> : null}
              </span>
            </span>
          ))}
        </div>
      )}

      {gridRun ? (
        <>
          <Score rt={gridRun} label={showVerify ? `v${last.patch.toVersion} re-verify` : `v${gridRun.run.agentVersion}`} />
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5" data-testid="redteam-grid">
            {(gridRun.cases.length ? gridRun.cases : PLACEHOLDERS).map((c) => (
              <CaseTile key={c.id} c={c} selected={open === c.id} onClick={() => c.category && setOpen(open === c.id ? null : c.id)} />
            ))}
          </div>
          {openCase && <CaseDetail c={openCase} />}
          {gridRun.run.source === "fallback" && gridRun.run.error && <p className="mt-3 text-[13px] text-muted-foreground">{gridRun.run.error}</p>}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed p-8 text-center text-[15px] text-muted-foreground">
          No red-team yet. Harbor will write 8–10 attacks (prompt injection, policy bypass, data exfiltration, social engineering, tool misuse, off-scope) and grade every response.
        </div>
      )}

      {rt?.run.status === "completed" && !first && fails > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-danger-soft px-5 py-4">
          <p className="text-[15px] font-medium text-danger">
            {fails} attack{fails === 1 ? "" : "s"} got through.
          </p>
          <Button disabled={!!busy} onClick={heal}>
            {busy === "heal" ? <Loader2 className="animate-spin" /> : <Sparkles />} Fix with Harbor
          </Button>
        </div>
      )}
      {rt?.run.status === "completed" && !first && fails === 0 && errored === 0 && (
        <p className="mt-6 flex items-center gap-2 rounded-2xl bg-success-soft px-5 py-4 text-[15px] font-medium text-success">
          <ShieldCheck className="size-5" /> Every attack was stopped.
        </p>
      )}
      {rt && !first && errored > 0 && (rt.run.status === "completed" || rt.run.status === "failed") && (
        <p className="mt-3 flex items-center gap-2 text-[14px] text-warning">
          <TriangleAlert className="size-4" /> {errored} attack{errored === 1 ? "" : "s"} couldn&apos;t be graded (timed out or interrupted). Click Red-team again to retry.
        </p>
      )}

      {proposed && <PatchDiff heal={first} busy={busy} onAccept={() => accept(first.patch.id)} onReject={() => reject(first.patch.id)} />}

      {showVerify && v && (
        <div className="mt-6 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Delta
              label="Attacks stopped"
              before={`${v.redteam.before.score}/${v.redteam.before.total}`}
              after={v.redteam.after ? `${v.redteam.after.score}/${v.redteam.after.total}` : null}
              good={!!v.redteam.after && v.redteam.after.score >= v.redteam.before.score}
            />
            <Delta
              label="Test tickets passing"
              before={v.tests.before ? `${v.tests.before.passed}/${v.tests.before.total}` : null}
              after={v.tests.after ? `${v.tests.after.passed}/${v.tests.after.total}` : null}
              good={!!v.tests.after && !!v.tests.before && v.tests.after.passed >= v.tests.before.passed}
            />
          </div>
          {chain.length > 1 && (
            <p className="text-[13px] text-muted-foreground">
              Harbor iterated {chain.length - 1} more time{chain.length > 2 ? "s" : ""} on its own: {chain.map((h) => `v${h.patch.toVersion ?? "?"} ${h.patch.status}`).join(" → ")}.
            </p>
          )}
          {v.regressions.length > 0 && (
            <div className="flex items-start gap-2 rounded-2xl bg-warning-soft px-5 py-4 text-[14px] text-warning">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                Regression: {v.regressions.map((r) => r.label).join("; ")}. {last.patch.iteration > 1 ? "Harbor rolled this automatic patch back." : "Review before deploying."}
              </span>
            </div>
          )}
          {v.error && <p className="text-[14px] text-danger">Verification failed: {v.error}</p>}
          {last.patch.status === "verified" && !verifying && (
            <p className="flex items-center gap-2 rounded-2xl bg-success-soft px-5 py-4 text-[15px] font-medium text-success">
              <ShieldCheck className="size-5" /> v{last.patch.toVersion} is verified{v.stillFailing.length ? `, ${v.stillFailing.length} attack(s) still need a human look` : ""}.
            </p>
          )}
          {verifying && (
            <p className="flex items-center gap-2 text-[14px] text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />{" "}
              {last.verification?.iterating ? "Some attacks still got through. Harbor is writing another patch…" : `Re-running the attacks and the 10 test tickets on v${last.patch.toVersion}…`}
            </p>
          )}
        </div>
      )}
      {error && <p className="mt-4 text-[14px] text-danger">{error}</p>}
    </section>
  );
}

function Score({ rt, label }: { rt: RedTeam; label: string }) {
  const done = rt.cases.filter((c) => c.result !== "pending" && c.result !== "running").length;
  const pass = rt.cases.filter((c) => c.result === "pass").length;
  const status = rt.run.status === "generating" ? "Writing attacks…" : rt.run.status === "running" ? `Attacking… ${done}/${rt.cases.length}` : rt.run.status === "failed" ? "Failed" : "Done";
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="display text-[32px] tabular-nums" data-testid="redteam-score">
        {pass}/{rt.cases.length || "–"}
      </span>
      <span className="text-[15px] text-muted-foreground">attacks stopped · {label} · {status}</span>
    </div>
  );
}

function CaseTile({ c, selected, onClick }: { c: Case; selected: boolean; onClick: () => void }) {
  const tone =
    c.result === "pass"
      ? "border-success/30 bg-success-soft text-success"
      : c.result === "fail"
        ? "border-danger/30 bg-danger-soft text-danger"
        : c.result === "error"
          ? "border-warning/30 bg-warning-soft text-warning"
          : "border-border bg-muted/60 text-muted-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      data-result={c.result}
      className={cn("flex min-h-[92px] flex-col justify-between rounded-2xl border p-3.5 text-left transition-all duration-500", tone, selected && "ring-2 ring-foreground/20")}
    >
      <span className="flex items-center justify-between gap-2 text-[12px] font-semibold uppercase tracking-wide">
        {c.category ? LABEL[c.category] ?? c.category : "Attack"}
        {c.result === "pass" ? <Check className="size-4" /> : c.result === "fail" ? <X className="size-4" /> : c.result === "running" ? <Loader2 className="size-4 animate-spin" /> : null}
      </span>
      <span className="line-clamp-2 text-[13px] font-medium text-foreground/80">{c.attackSubject ?? <span className="shimmer block h-3 w-3/4 rounded" />}</span>
    </button>
  );
}

function CaseDetail({ c }: { c: Case }) {
  return (
    <div className="mt-3 rounded-2xl border bg-muted/40 p-4 text-[14px]">
      <p className="font-semibold">
        {c.result.toUpperCase()}: {c.reason ?? "Grading…"}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{c.attackText}</p>
      {c.agentRunId && (
        <Link href={`/runs/${c.agentRunId}`} className="mt-2 inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline">
          Open the run timeline <ArrowRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

function PatchDiff({ heal, busy, onAccept, onReject }: { heal: Heal; busy: string | null; onAccept: () => void; onReject: () => void }) {
  return (
    <div className="mt-6 rounded-2xl border p-5" data-testid="heal-diff">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[16px] font-semibold">
            <Sparkles className="size-4" /> Proposed patch: v{heal.patch.fromVersion} → v{heal.patch.fromVersion + 1}
          </p>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {heal.patch.patch.summary} {heal.patch.source === "fallback" && "(Harbor's rule-based patch)"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!!busy} onClick={onReject}>
            {busy === "reject" ? <Loader2 className="animate-spin" /> : <X />} Reject
          </Button>
          <Button variant="success" disabled={!!busy} onClick={onAccept}>
            {busy === "accept" ? <Loader2 className="animate-spin" /> : <Check />} Accept &amp; re-verify
          </Button>
        </div>
      </div>
      <ul className="space-y-2.5">
        {heal.changes.map((c, i) => (
          <li key={i} className="rounded-xl bg-muted/50 p-3.5 text-[14px]">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              {c.kind === "guardrail" ? "Code guardrail" : c.kind === "approval" ? "Needs approval" : c.label}
              {c.kind === "approval" && `: ${c.label}`}
            </p>
            {c.before && <p className="mt-1.5 rounded-md bg-danger-soft px-2 py-1 text-danger line-through decoration-danger/50">{c.before}</p>}
            <p className="mt-1.5 rounded-md bg-success-soft px-2 py-1 text-success">{c.after}</p>
            {c.why && <p className="mt-1.5 text-[13px] text-muted-foreground">{c.why}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Delta({ label, before, after, good }: { label: string; before: string | null; after: string | null; good: boolean }) {
  return (
    <div className="rounded-2xl border p-4">
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-[22px] font-semibold tabular-nums" data-testid={`delta-${label}`}>
        <span className="text-muted-foreground">{before ?? "…"}</span>
        <ArrowRight className="size-4 text-muted-foreground" />
        <span className={after ? (good ? "text-success" : "text-danger") : "text-muted-foreground"}>{after ?? <Loader2 className="size-5 animate-spin" />}</span>
      </p>
    </div>
  );
}

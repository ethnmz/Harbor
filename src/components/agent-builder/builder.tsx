"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Loader2, Lock, Rocket, Sparkles, X } from "lucide-react";
import { AmbientGlow } from "@/components/ambient-glow";
import { Mascot } from "@/components/mascots/mascot";
import { SpeechBubble } from "@/components/mascots/speech-bubble";
import { Chip, FieldTitle, Slider } from "@/components/onboarding/controls";
import { Button } from "@/components/ui/button";
import { Input, Select, Switch, Textarea } from "@/components/ui/primitives";
import type { AgentConfig } from "@/lib/engine/config";
import type { GenerateResult } from "@/lib/engine/generate";
import type { ModelInfo } from "@/lib/llm/models";
import type { MascotKind } from "@/lib/mascots";
import type { ToolCatalogEntry } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { BuilderWorkspace } from "./config-card";
import { summarize, TestReport, useBatch } from "./test-report";

/**
 * Creating an agent, one question per screen (like onboarding): describe the job, meet the
 * agent Harbor wrote, choose what it can use, set its limits, test it on 10 tickets, go live.
 */
const STEPS = ["describe", "meet", "tools", "limits", "test", "live"] as const;
type StepId = (typeof STEPS)[number];
const QUESTIONS = STEPS.slice(0, -1);

const GUIDE: Record<StepId, MascotKind[]> = {
  describe: ["murmur"],
  meet: ["orbit"],
  tools: ["facet"],
  limits: ["orbit"],
  test: ["facet"],
  live: ["orbit"],
};

const EXAMPLES = [
  {
    label: "Ticket triage",
    text: "Sort incoming support tickets by urgency, look up outage news if a ticket mentions an outage, and post urgent ones to #support-urgent.",
  },
  { label: "Refund handler", text: "Handle refund requests: check the customer's invoices, refund duplicate or mistaken charges within policy, and email the customer to confirm." },
  { label: "Outage watcher", text: "When customers say something is down, check live news for a third-party outage and alert #support-urgent with the evidence." },
];

export type BuilderDraft = {
  agentId: string;
  config: AgentConfig;
  prompt: string;
  sourceName?: string | null;
  status: string;
};

async function call<T>(url: string, body?: unknown, method = "POST"): Promise<T> {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({ error: `Server error (${res.status}). Try again.` }));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export function AgentBuilder({
  catalog,
  models,
  workspace,
  llmLive,
  draft,
  initialPrompt,
}: {
  catalog: ToolCatalogEntry[];
  models: ModelInfo[];
  workspace: BuilderWorkspace;
  llmLive: boolean;
  draft?: BuilderDraft;
  /** From the home composer: prefill and start generating right away. */
  initialPrompt?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<StepId>(draft ? "meet" : "describe");
  const [cue, setCue] = useState(0);
  const [description, setDescription] = useState(draft?.prompt ?? initialPrompt ?? "");
  const [config, setConfig] = useState<AgentConfig | null>(draft?.config ?? null);
  const [gen, setGen] = useState<Pick<GenerateResult, "adjustments" | "reasoning" | "provider" | "latencyMs"> | null>(null);
  const [agentId, setAgentId] = useState<string | null>(draft?.agentId ?? null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rows = useBatch(batchId);
  const report = summarize(rows);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const q = QUESTIONS.indexOf(step as (typeof QUESTIONS)[number]);

  function go(s: StepId) {
    setStep(s);
    setCue((c) => c + 1);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    if (step === "describe") inputRef.current?.focus();
  }, [step]);

  const autoStarted = useRef(false);
  useEffect(() => {
    if (initialPrompt && !draft && !autoStarted.current) {
      autoStarted.current = true;
      void generate();
    }
    // Runs once on mount for a prompt handed over from the home composer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    if (description.trim().length < 8 || generating) return;
    setError(null);
    setGenerating(true);
    try {
      const result = await call<GenerateResult>("/api/agents/generate", { description });
      setConfig(result.config);
      setGen(result);
      go("meet");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function saveAndTest() {
    if (!config) return;
    setBusy(true);
    setError(null);
    try {
      let id = agentId;
      if (id) {
        const r = await call<{ config: AgentConfig }>(`/api/agents/${id}`, { config }, "PATCH");
        setConfig(r.config);
      } else {
        const r = await call<{ agentId: string }>("/api/agents", { config, prompt: description });
        id = r.agentId;
        setAgentId(id);
      }
      const b = await call<{ batchId: string }>(`/api/agents/${id}/test-runs`);
      setBatchId(b.batchId);
      go("test");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deploy() {
    if (!agentId) return;
    setBusy(true);
    setError(null);
    try {
      await call(`/api/agents/${agentId}/deploy`, { status: "live" });
      setDeployed(true);
      setCue((c) => c + 1);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (busy || generating) return;
    if (step === "describe") return void generate();
    if (step === "limits") return void saveAndTest();
    if (step === "test") return report.finished && go("live");
    if (step === "live") return void (deployed ? router.push(`/agents/${agentId}`) : deploy());
    go(STEPS[STEPS.indexOf(step) + 1]);
  }
  function back() {
    const i = STEPS.indexOf(step);
    if (step === "live") return go("test");
    if (step === "test") return go("limits");
    if (i > (draft ? 1 : 0)) go(STEPS[i - 1]);
  }
  function exit() {
    router.push(agentId ? `/agents/${agentId}` : "/agents");
  }

  // Enter continues and Esc leaves, unless the user is typing in a field.
  const keys = useRef({ next, exit });
  useEffect(() => {
    keys.current = { next, exit };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, button, a, summary")) return;
      if (e.key === "Enter") keys.current.next();
      if (e.key === "Escape") keys.current.exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const worked = report.handled + report.flagged + report.waiting;
  const name = config?.name || "your agent";
  const screens: Record<StepId, { line: React.ReactNode; title: string; subtitle: string; body: React.ReactNode; cta: React.ReactNode; canNext: boolean }> = {
    describe: {
      line: generating ? "Writing your agent: picking the fewest tools, writing its instructions, applying company policy…" : "Tell me the job like you'd tell a new teammate. I'll handle the setup.",
      title: "What should your agent do?",
      subtitle: `It inherits ${workspace.company}'s tools, approvals and guardrails automatically.`,
      body: (
        <div>
          <Textarea
            ref={inputRef}
            aria-label="What should your agent do?"
            value={description}
            disabled={generating}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void generate();
            }}
            placeholder="e.g. Sort incoming support tickets by urgency and post urgent ones to #support-urgent"
            className="min-h-32 border-white/80 bg-white/60 text-[16px] leading-relaxed"
          />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-muted-foreground">Or try:</span>
            {EXAMPLES.map((ex) => (
              <Chip key={ex.label} selected={description === ex.text} onClick={() => setDescription(ex.text)} className="h-9 text-[13px]">
                {ex.label}
              </Chip>
            ))}
          </div>
        </div>
      ),
      cta: generating ? (
        <>
          <Loader2 className="animate-spin" /> Writing…
        </>
      ) : (
        <>
          <Sparkles /> Create my agent
        </>
      ),
      canNext: description.trim().length >= 8 && !generating,
    },
    meet: {
      line: draft?.sourceName ? `Cloned from ${draft.sourceName}. Give it a name and check the job.` : gen?.reasoning || "Here's who I wrote. Rename it or tweak the job if you like.",
      title: `Meet ${name}`,
      subtitle: "This is what it will do on every ticket.",
      body: config && <MeetStep config={config} onChange={setConfig} catalog={catalog} adjustments={gen?.adjustments ?? []} />,
      cta: "Looks good",
      canNext: !!config?.name.trim(),
    },
    tools: {
      line: "Only what the job needs. For anything risky, I'll ask a manager first.",
      title: "What can it use?",
      subtitle: "Switch tools on or off. “Ask first” pauses the agent until a manager approves.",
      body: config && <ToolsStep config={config} onChange={setConfig} catalog={catalog} workspace={workspace} />,
      cta: "Continue",
      canNext: !!config?.allowedTools.length,
    },
    limits: {
      line: "Limits are enforced in code, whatever the agent decides. Anything bigger goes to a person.",
      title: "Set its limits",
      subtitle: "Your company's maximums apply. You can be stricter, never looser.",
      body: config && <LimitsStep config={config} onChange={setConfig} models={models} workspace={workspace} llmLive={llmLive} />,
      cta: busy ? (
        <>
          <Loader2 className="animate-spin" /> Saving…
        </>
      ) : (
        "Save & test on 10 tickets"
      ),
      canNext: !busy,
    },
    test: {
      line: report.finished
        ? `Done! ${worked} of ${report.total} worked end to end${report.flagged + report.waiting ? `, and ${report.flagged + report.waiting} went to a person, as they should` : ""}.`
        : `Running ${name} on 10 sample tickets in parallel. Nothing real is sent until you deploy.`,
      title: report.finished ? "Test complete" : "Testing on 10 tickets",
      subtitle: "Open any ticket to watch every step the agent took.",
      body: <TestReport rows={rows} />,
      cta: report.finished ? "Continue" : (
        <>
          <Loader2 className="animate-spin" /> Testing…
        </>
      ),
      canNext: report.finished,
    },
    live: {
      line: deployed ? `${name} is on the job. I'll keep an eye on it.` : "Looking good! Go live now, or keep it as a draft and come back later.",
      title: deployed ? `${name} is live` : "Ready to go live?",
      subtitle: deployed
        ? "It works new tickets as they arrive. Risky actions wait for approval, and every step lands in the activity log."
        : `${worked}/${report.total || 10} test tickets worked end to end. Risky actions will wait for a manager.`,
      body: deployed ? null : (
        <ul className="space-y-2.5 text-[15px]">
          <Summary label="Uses" value={config?.allowedTools.map((t) => catalog.find((c) => c.name === t)?.label ?? t).join(", ")} />
          <Summary label="Asks first for" value={config?.riskyTools.map((t) => catalog.find((c) => c.name === t)?.label ?? t).join(", ") || "Nothing"} />
          <Summary label="Limits" value={config && `${config.guardrails.maxSteps} steps · $${config.guardrails.maxCostUsd.toFixed(2)} per run${config.allowedTools.includes("issue_refund") ? ` · refunds up to $${config.guardrails.maxRefundUsd}` : ""}`} />
        </ul>
      ),
      cta: deployed ? (
        <>
          Open agent <ArrowRight />
        </>
      ) : busy ? (
        <>
          <Loader2 className="animate-spin" /> Deploying…
        </>
      ) : (
        <>
          <Rocket /> Go live
        </>
      ),
      canNext: !busy,
    },
  };
  const s = screens[step];
  const canBack = step !== "describe" && !(draft && step === "meet") && !deployed && !busy;

  return (
    <div className="relative min-h-screen pb-16">
      <AmbientGlow />
      <div className={cn("mx-auto px-5", step === "test" ? "max-w-[880px]" : "max-w-[720px]")}>
        <header className="flex items-center gap-4 pt-6">
          <button type="button" onClick={exit} aria-label="Leave" className="glass flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-105">
            <X className="size-5" />
          </button>
          <div
            role="progressbar"
            aria-label="Agent setup progress"
            aria-valuemin={0}
            aria-valuemax={QUESTIONS.length}
            aria-valuenow={step === "live" ? QUESTIONS.length : q + 1}
            className="h-3 flex-1 overflow-hidden rounded-full bg-black/[0.07]"
          >
            <div className="h-full rounded-full bg-foreground transition-[width] duration-500 ease-out" style={{ width: `${step === "live" ? 100 : ((q + 1) / QUESTIONS.length) * 100}%` }} />
          </div>
          <span className="w-12 shrink-0 text-right text-[13px] font-semibold text-muted-foreground tabular-nums">{step === "live" ? "Done" : `${q + 1} / ${QUESTIONS.length}`}</span>
        </header>

        {/* Same tree on every step so the mascot canvas stays mounted and just hops to the next guide. */}
        <section className="mt-8 flex items-center gap-4 sm:gap-6">
          <Mascot kinds={GUIDE[step]} width={150} height={150} cue={cue} celebrate={deployed} interactive />
          <SpeechBubble key={`${step}-${generating}-${report.finished}-${deployed}`} tail="left" className="flex-1 animate-rise">
            {s.line}
          </SpeechBubble>
        </section>

        <div key={step} className="mt-9 animate-rise">
          <h1 className="display text-[30px] sm:text-[34px]">{s.title}</h1>
          <p className="mt-2 max-w-[600px] text-[16px] leading-relaxed text-muted-foreground">{s.subtitle}</p>
          {s.body && <div className={cn("mt-7", step === "test" ? "" : "glass rounded-[24px] p-5 sm:p-7")}>{s.body}</div>}
          {error && <p className="mt-4 rounded-xl bg-danger-soft px-4 py-2.5 text-[14px] text-danger">{error}</p>}

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-3">
            {canBack ? (
              <Button variant="outline" size="lg" className="rounded-full px-6" onClick={back}>
                <ArrowLeft /> Go back
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap gap-3">
              {step === "live" && !deployed && agentId && (
                <Button variant="ghost" size="lg" className="rounded-full px-6" asChild>
                  <Link href={`/agents/${agentId}`}>Keep as draft</Link>
                </Button>
              )}
              {step === "live" && deployed && (
                <Button variant="outline" size="lg" className="rounded-full px-6" asChild>
                  <Link href="/dashboard">Go to Home</Link>
                </Button>
              )}
              <Button size="lg" className="rounded-full px-8" onClick={next} disabled={!s.canNext}>
                {s.cta}
              </Button>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </li>
  );
}

function MeetStep({ config, onChange, catalog, adjustments }: { config: AgentConfig; onChange: (c: AgentConfig) => void; catalog: ToolCatalogEntry[]; adjustments: string[] }) {
  const label = (t: string) => catalog.find((c) => c.name === t)?.label ?? t;
  return (
    <div className="space-y-5">
      <div>
        <FieldTitle>Name</FieldTitle>
        <Input aria-label="Agent name" value={config.name} onChange={(e) => onChange({ ...config, name: e.target.value })} className="h-12 border-white/80 bg-white/60 text-[17px] font-semibold" />
      </div>
      <div>
        <FieldTitle>Its job</FieldTitle>
        <Textarea
          aria-label="Description"
          value={config.description}
          rows={2}
          onChange={(e) => onChange({ ...config, description: e.target.value })}
          className="min-h-0 resize-none border-white/80 bg-white/60 text-[15px]"
        />
      </div>
      <div>
        <FieldTitle>On every ticket it can</FieldTitle>
        <div className="flex flex-wrap gap-2">
          {config.allowedTools.map((t) => (
            <span key={t} className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-[14px] font-medium ring-1 ring-black/5">
              {config.riskyTools.includes(t) ? <Lock className="size-3.5 text-muted-foreground" /> : <Check className="size-3.5 text-success" />}
              {label(t)}
            </span>
          ))}
        </div>
      </div>
      {adjustments.length > 0 && <p className="text-[13px] text-muted-foreground">Company policy applied: {adjustments.join(" ")}</p>}
    </div>
  );
}

function ToolsStep({ config, onChange, catalog, workspace }: { config: AgentConfig; onChange: (c: AgentConfig) => void; catalog: ToolCatalogEntry[]; workspace: BuilderWorkspace }) {
  const policyRisky = new Set(workspace.policies.approvalRequiredTools);
  const live = (conn: string) => workspace.connections.find((c) => c.key === conn)?.live;
  const toggleTool = (name: string, on: boolean) => {
    const allowedTools = on ? [...config.allowedTools, name] : config.allowedTools.filter((t) => t !== name);
    let riskyTools = config.riskyTools.filter((t) => allowedTools.includes(t));
    if (on && policyRisky.has(name) && !riskyTools.includes(name)) riskyTools = [...riskyTools, name];
    let allowedSlackChannels = config.guardrails.allowedSlackChannels;
    if (on && name === "post_slack_message" && !allowedSlackChannels.length) allowedSlackChannels = [workspace.policies.allowedSlackChannels[0]];
    onChange({ ...config, allowedTools, riskyTools, guardrails: { ...config.guardrails, allowedSlackChannels } });
  };
  const toggleRisky = (name: string, on: boolean) => onChange({ ...config, riskyTools: on ? [...config.riskyTools, name] : config.riskyTools.filter((t) => t !== name) });
  return (
    <ul className="divide-y divide-black/5">
      {catalog.map((t) => {
        const on = config.allowedTools.includes(t.name);
        const ask = config.riskyTools.includes(t.name);
        const locked = policyRisky.has(t.name);
        return (
          <li key={t.name} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5 first:pt-0 last:pb-0">
            <Switch checked={on} onChange={(v) => toggleTool(t.name, v)} label={t.label} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[15px] font-semibold">
                {t.label}
                {!live(t.connection) && <span className="text-[12px] font-medium text-muted-foreground">simulated</span>}
              </div>
              <div className="line-clamp-1 text-[13px] text-muted-foreground">{t.description}</div>
            </div>
            {on && (t.risky || locked) && (
              <button
                type="button"
                disabled={locked}
                onClick={() => toggleRisky(t.name, !ask)}
                title={locked ? "Company policy: always needs a manager's approval" : undefined}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors",
                  ask ? "bg-foreground text-background" : "bg-white/70 text-muted-foreground ring-1 ring-black/10 hover:text-foreground",
                  locked && "cursor-default",
                )}
              >
                {locked ? <Lock className="size-3.5" /> : ask ? <Check className="size-3.5" /> : null} Ask first
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function LimitsStep({
  config,
  onChange,
  models,
  workspace,
  llmLive,
}: {
  config: AgentConfig;
  onChange: (c: AgentConfig) => void;
  models: ModelInfo[];
  workspace: BuilderWorkspace;
  llmLive: boolean;
}) {
  const p = workspace.policies;
  const g = config.guardrails;
  const setG = <K extends keyof AgentConfig["guardrails"]>(k: K, v: AgentConfig["guardrails"][K]) => onChange({ ...config, guardrails: { ...g, [k]: v } });
  const slack = config.allowedTools.includes("post_slack_message");
  return (
    <div className="space-y-7">
      {config.allowedTools.includes("issue_refund") && (
        <Slider id="refund" label="Largest refund it may issue" valueText={`$${g.maxRefundUsd}`} min={0} max={p.maxRefundUsd} step={5} value={Math.min(g.maxRefundUsd, p.maxRefundUsd)} onChange={(v) => setG("maxRefundUsd", v)} />
      )}
      <Slider id="steps" label="Steps per ticket" valueText={`${g.maxSteps} steps`} min={2} max={p.maxStepsPerRun} value={Math.min(g.maxSteps, p.maxStepsPerRun)} onChange={(v) => setG("maxSteps", v)} />
      {slack && (
        <div>
          <FieldTitle>Slack channels it may post to</FieldTitle>
          <div className="flex flex-wrap gap-2">
            {p.allowedSlackChannels.map((c) => {
              const on = g.allowedSlackChannels.includes(c);
              return (
                <Chip key={c} selected={on} onClick={() => setG("allowedSlackChannels", on ? g.allowedSlackChannels.filter((x) => x !== c) : [...g.allowedSlackChannels, c])}>
                  {c}
                </Chip>
              );
            })}
          </div>
        </div>
      )}
      <details className="group rounded-2xl bg-white/50 ring-1 ring-black/5">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[14px] font-semibold">
          Advanced: model and instructions
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-4 px-4 pb-4">
          <div>
            <label htmlFor="model" className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              Model{!llmLive && " (simulated until an Anthropic key is added)"}
            </label>
            <Select id="model" value={config.model} onChange={(e) => onChange({ ...config, model: e.target.value })}>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {m.id === workspace.defaultModel ? " · default" : ""}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="instructions" className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              Instructions (the agent follows these step by step)
            </label>
            <Textarea id="instructions" value={config.instructions} onChange={(e) => onChange({ ...config, instructions: e.target.value })} className="min-h-56 font-mono text-[12.5px] leading-6" />
          </div>
        </div>
      </details>
    </div>
  );
}

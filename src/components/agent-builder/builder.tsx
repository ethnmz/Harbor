"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CornerDownLeft, FlaskConical, Info, Loader2, Rocket, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, Textarea } from "@/components/ui/primitives";
import { LiveDot } from "@/components/status";
import type { AgentConfig } from "@/lib/engine/config";
import type { GenerateResult } from "@/lib/engine/generate";
import type { ModelInfo } from "@/lib/llm/models";
import type { ToolCatalogEntry } from "@/lib/queries";
import { cn, formatMs, formatUsd } from "@/lib/utils";
import { ConfigCard, type BuilderWorkspace } from "./config-card";
import { summarize, TestReport, useBatch } from "./test-report";
import { Mascot } from "@/components/mascots/mascot";
import { SpeechBubble } from "@/components/mascots/speech-bubble";

type Stage = "describe" | "generating" | "config" | "testing" | "live";

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
  const [stage, setStage] = useState<Stage>(draft ? "config" : "describe");
  const [description, setDescription] = useState(draft?.prompt ?? initialPrompt ?? "");
  const [config, setConfig] = useState<AgentConfig | null>(draft?.config ?? null);
  const [gen, setGen] = useState<Pick<GenerateResult, "adjustments" | "reasoning" | "provider" | "latencyMs"> | null>(null);
  const [agentId, setAgentId] = useState<string | null>(draft?.agentId ?? null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rows = useBatch(batchId);
  const report = summarize(rows);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (stage === "describe") inputRef.current?.focus();
  }, [stage]);

  const autoStarted = useRef(false);
  useEffect(() => {
    if (initialPrompt && !draft && !autoStarted.current) {
      autoStarted.current = true;
      void generate();
    }
    // Runs once on mount for a prompt handed over from the home composer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function call<T>(url: string, body?: unknown, method = "POST"): Promise<T> {
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
    return data as T;
  }

  async function generate() {
    if (description.trim().length < 8) return;
    setError(null);
    setStage("generating");
    try {
      const result = await call<GenerateResult>("/api/agents/generate", { description });
      setConfig(result.config);
      setGen(result);
      setStage("config");
    } catch (e) {
      setError((e as Error).message);
      setStage("describe");
    }
  }

  async function saveAndTest() {
    if (!config) return;
    setBusy(true);
    setError(null);
    try {
      let id = agentId;
      if (id) {
        const r = await call<{ config: AgentConfig; adjustments: string[] }>(`/api/agents/${id}`, { config }, "PATCH");
        setConfig(r.config);
      } else {
        const r = await call<{ agentId: string }>("/api/agents", { config, prompt: description });
        id = r.agentId;
        setAgentId(id);
      }
      const b = await call<{ batchId: string }>(`/api/agents/${id}/test-runs`);
      setBatchId(b.batchId);
      setStage("testing");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deploy() {
    if (!agentId) return;
    setBusy(true);
    try {
      await call(`/api/agents/${agentId}/deploy`, { status: "live" });
      setStage("live");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const steps: { key: Stage[]; label: string }[] = [
    { key: ["describe", "generating"], label: "Describe" },
    { key: ["config"], label: "Review config" },
    { key: ["testing"], label: "Test on 10 tickets" },
    { key: ["live"], label: "Deploy" },
  ];
  const currentIdx = steps.findIndex((s) => s.key.includes(stage));

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <ol className="flex flex-wrap items-center gap-2 text-[13px]">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full border text-[11px] font-semibold",
                i < currentIdx && "border-primary bg-primary text-white",
                i === currentIdx && "border-primary text-primary",
                i > currentIdx && "text-muted-foreground",
              )}
            >
              {i < currentIdx ? <Check className="size-3" /> : i + 1}
            </span>
            <span className={cn(i === currentIdx ? "font-medium" : "text-muted-foreground")}>{s.label}</span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-border" />}
          </li>
        ))}
      </ol>

      {error && <div className="rounded-lg border border-danger/20 bg-danger-soft px-4 py-2.5 text-sm text-danger">{error}</div>}

      {(stage === "describe" || stage === "generating") && (
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <Card className="p-5">
            <label htmlFor="describe" className="text-[15px] font-semibold tracking-tight">
              What should your agent do?
            </label>
            <p className="mt-1 text-sm text-muted-foreground">Describe the job like you would to a new teammate. Harbor picks the tools, writes the instructions and applies your company&apos;s policies.</p>
            <div className="relative mt-4">
              <Textarea
                ref={inputRef}
                id="describe"
                value={description}
                disabled={stage === "generating"}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void generate();
                }}
                placeholder="e.g. Sort incoming support tickets by urgency and post urgent ones to #support-urgent…"
                className="min-h-32 pb-12 text-[15px]"
              />
              <div className="absolute right-2.5 bottom-2.5 flex items-center gap-2">
                <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                  <CornerDownLeft className="size-3" /> ⌘ Enter
                </span>
                <Button onClick={generate} disabled={stage === "generating" || description.trim().length < 8}>
                  {stage === "generating" ? <Loader2 className="animate-spin" /> : <Wand2 />}
                  {stage === "generating" ? "Designing your agent…" : "Generate agent"}
                </Button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Try:</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  onClick={() => setDescription(ex.text)}
                  className="cursor-pointer rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                >
                  {ex.label}
                </button>
              ))}
            </div>
            {stage === "generating" && (
              <div className="mt-5 flex items-center gap-4">
                <Mascot kinds={["murmur"]} width={112} height={112} label="Murmur is writing your agent" />
                <SpeechBubble speaker="murmur" className="flex-1">
                  <div className="space-y-1.5">
                    {["Reading your description", "Choosing the fewest tools that do the job", "Writing step-by-step instructions", "Applying company policy"].map((t, i) => (
                      <div key={t} className="flex items-center gap-2 text-[14px] text-muted-foreground animate-rise" style={{ animationDelay: `${i * 450}ms` }}>
                        <Loader2 className="size-3.5 animate-spin text-foreground" /> {t}
                      </div>
                    ))}
                  </div>
                </SpeechBubble>
              </div>
            )}
          </Card>
          <InheritedPanel workspace={workspace} llmLive={llmLive} />
        </div>
      )}

      {stage === "config" && config && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              {draft?.sourceName && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="primary">Cloned</Badge> from {draft.sourceName}. Workspace tools, model and guardrails were carried over.
                </div>
              )}
              {gen && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="size-4 text-primary" />
                  Generated {gen.provider.startsWith("simulated") ? "offline by the Harbor simulator" : `by ${models.find((m) => m.id === workspace.defaultModel)?.label ?? "the model"}`} in {formatMs(gen.latencyMs)}.
                  <span className="text-foreground/80">{gen.reasoning}</span>
                </div>
              )}
              {gen && gen.adjustments.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning-soft px-3 py-2 text-sm text-warning">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <span className="font-medium">Company policy applied: </span>
                    {gen.adjustments.join(" ")}
                  </div>
                </div>
              )}
            </div>
          </div>
          <ConfigCard config={config} onChange={setConfig} catalog={catalog} models={models} workspace={workspace} />
          <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-xl border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
            {!draft && (
              <Button variant="ghost" onClick={() => setStage("describe")}>
                <ArrowLeft /> Back
              </Button>
            )}
            <div className="hidden text-sm text-muted-foreground md:block">
              {config.allowedTools.length} tools · {config.riskyTools.length} need approval · max {config.guardrails.maxSteps} steps · {formatUsd(config.guardrails.maxCostUsd, 2)}/run
            </div>
            <Button className="ml-auto" size="lg" onClick={saveAndTest} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <FlaskConical />}
              Save &amp; test on 10 tickets
            </Button>
          </div>
        </div>
      )}

      {stage === "testing" && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Mascot kinds={["facet"]} width={112} height={112} cue={report.finished ? 1 : 0} label="Facet is running the test" />
            <SpeechBubble speaker="facet" className="flex-1">
              {report.finished
                ? `Done! ${report.handled + report.flagged + report.waiting} of ${report.total} worked end to end. Have a look, then deploy when you're happy.`
                : `Running ${config?.name ?? "your agent"} on 10 sample tickets in parallel. Open any of them to watch it work.`}
            </SpeechBubble>
          </div>
          <TestReport rows={rows} />
          <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
            {report.finished ? (
              <>
                <div className="text-sm">
                  <span className="font-medium">
                    {report.handled + report.flagged + report.waiting}/{report.total} worked end to end
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {report.flagged + report.waiting} routed to a human{report.failed ? ` · ${report.failed} failed` : ""}. Every step is logged.
                  </span>
                </div>
                <div className="ml-auto flex gap-2">
                  {report.waiting > 0 && (
                    <Button variant="outline" asChild>
                      <Link href="/approvals">Review approvals</Link>
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setStage("config")}>
                    Edit config
                  </Button>
                  <Button size="lg" onClick={deploy} disabled={busy}>
                    {busy ? <Loader2 className="animate-spin" /> : <Rocket />} Deploy agent
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" /> Agents run in parallel. Open any timeline to watch it live.
              </div>
            )}
          </div>
        </div>
      )}

      {stage === "live" && config && agentId && (
        <Card className="relative overflow-hidden px-6 py-10 text-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,var(--success-soft),transparent_60%)]" />
          <Mascot kinds={["orbit"]} width={150} height={150} celebrate className="relative mx-auto" label="Orbit celebrating" />
          <h2 className="display relative mt-5 text-[30px]">{config.name} is live</h2>
          <p className="relative mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
            It works new tickets as they arrive. Risky actions wait for approval, and every step lands in the activity log.
          </p>
          <div className="relative mt-3 flex justify-center">
            <Badge variant="success">
              <LiveDot /> Watching the support inbox
            </Badge>
          </div>
          <div className="relative mt-6 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href={`/agents/${agentId}`}>
                Open agent <ArrowRight />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard">Monitoring dashboard</Link>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function InheritedPanel({ workspace, llmLive }: { workspace: BuilderWorkspace; llmLive: boolean }) {
  return (
    <Card className="h-fit p-5">
      <div className="flex items-center gap-2 text-[13px] font-semibold">
        <Info className="size-4 text-primary" /> Inherited from your workspace
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Set up once in onboarding. Every new agent reuses it.</p>
      <div className="mt-4 space-y-3 text-[13px]">
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Connected tools</div>
          <div className="space-y-1">
            {workspace.connections.map((c) => (
              <div key={c.key} className="flex items-center gap-2" title={c.detail}>
                <span className={cn("size-1.5 rounded-full", c.live ? "bg-success" : "bg-muted-foreground/40")} />
                {c.name}
                <span className="ml-auto text-xs text-muted-foreground">{c.live ? "Live" : "Simulated"}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-xs font-medium text-muted-foreground">Default model</span>
          <span className="flex items-center gap-1.5">
            <span className={cn("size-1.5 rounded-full", llmLive ? "bg-success" : "bg-muted-foreground/40")} />
            <code className="font-mono text-xs">{workspace.defaultModel}</code>
          </span>
        </div>
        <div className="border-t pt-3">
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Policies</div>
          <ul className="space-y-1 text-xs">
            <li>
              Approval required: <span className="font-mono">{workspace.policies.approvalRequiredTools.join(", ")}</span>
            </li>
            <li>Refunds over ${workspace.policies.maxRefundUsd} go to a human</li>
            <li>
              Max {workspace.policies.maxStepsPerRun} steps and ${workspace.policies.maxCostPerRunUsd.toFixed(2)} per run
            </li>
            <li>+ {workspace.policies.rules.length} company rules</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, Lock, Plug, Plus, ShieldCheck, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, Input, Label, Switch } from "@/components/ui/primitives";
import type { WorkspacePolicies } from "@/lib/db/schema";
import type { ModelInfo } from "@/lib/llm/models";
import type { ToolCatalogEntry } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Connection = { key: string; name: string; enabled: boolean; live: boolean; detail: string; envVar: string | null };

const STEPS = ["Connect tools", "Pick a model", "Company policies", "Done"];

export function OnboardingWizard({
  company,
  connections: initialConnections,
  models,
  defaultModel,
  policies: initialPolicies,
  catalog,
  llmLive,
  onboarded,
}: {
  company: string;
  connections: Connection[];
  models: ModelInfo[];
  defaultModel: string;
  policies: WorkspacePolicies;
  catalog: ToolCatalogEntry[];
  llmLive: boolean;
  onboarded: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [connections, setConnections] = useState(initialConnections);
  const [model, setModel] = useState(defaultModel);
  const [policies, setPolicies] = useState(initialPolicies);
  const [tests, setTests] = useState<Record<string, { busy?: boolean; ok?: boolean; live?: boolean; message?: string }>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newChannel, setNewChannel] = useState("");
  const [newRule, setNewRule] = useState("");

  async function test(key: string) {
    setTests((t) => ({ ...t, [key]: { busy: true } }));
    const res = await fetch(`/api/connections/${key}/test`, { method: "POST" });
    const data = await res.json();
    setTests((t) => ({ ...t, [key]: data }));
  }

  async function save(complete: boolean) {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/workspace", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ defaultModel: model, policies, enabledConnections: Object.fromEntries(connections.map((c) => [c.key, c.enabled])), complete }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Could not save");
      return false;
    }
    router.refresh();
    return true;
  }

  const next = async () => {
    if (step === 2 && !(await save(true))) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const setP = <K extends keyof WorkspacePolicies>(k: K, v: WorkspacePolicies[K]) => setPolicies((p) => ({ ...p, [k]: v }));

  return (
    <div className="mx-auto max-w-3xl">
      <ol className="mb-6 grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => i < 3 && setStep(i)} className="w-full cursor-pointer text-left">
              <div className={cn("h-1 rounded-full", i <= step ? "bg-primary" : "bg-border")} />
              <div className={cn("mt-2 text-xs", i === step ? "font-medium text-foreground" : "text-muted-foreground")}>
                {i + 1}. {s}
              </div>
            </button>
          </li>
        ))}
      </ol>

      {error && <div className="mb-4 rounded-lg bg-danger-soft px-4 py-2 text-sm text-danger">{error}</div>}

      {step === 0 && (
        <Card className="p-6 animate-rise">
          <h2 className="text-lg font-semibold tracking-tight">Connect your tools once</h2>
          <p className="mt-1 text-sm text-muted-foreground">Every agent in {company}&apos;s workspace reuses these connections. Secrets stay in your environment, never in the database.</p>
          <div className="mt-5 space-y-2.5">
            {connections.map((c) => {
              const t = tests[c.key];
              return (
                <div key={c.key} className="rounded-lg border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-md bg-muted">
                      <Plug className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {c.name}
                        {c.live ? <Badge variant="success">Live</Badge> : <Badge variant="outline">Simulated</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.detail}
                        {c.envVar && !c.live && (
                          <>
                            {" "}
                            (<code className="font-mono">{c.envVar}</code>)
                          </>
                        )}
                      </div>
                    </div>
                    {(c.key === "serpapi" || c.key === "slack") && (
                      <Button size="sm" variant="outline" onClick={() => test(c.key)} disabled={t?.busy}>
                        {t?.busy ? <Loader2 className="animate-spin" /> : null} Test
                      </Button>
                    )}
                    <Switch checked={c.enabled} onChange={(v) => setConnections((cs) => cs.map((x) => (x.key === c.key ? { ...x, enabled: v } : x)))} label={`Enable ${c.name}`} />
                  </div>
                  {t?.message && (
                    <div className={cn("mt-2 rounded-md px-2.5 py-1.5 text-xs", t.ok ? (t.live ? "bg-success-soft text-success" : "bg-muted text-muted-foreground") : "bg-danger-soft text-danger")}>
                      {t.message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card className="p-6 animate-rise">
          <h2 className="text-lg font-semibold tracking-tight">Pick a default model</h2>
          <p className="mt-1 text-sm text-muted-foreground">New agents start with this model. Each agent can override it. {llmLive ? "Your Anthropic key is connected." : "No ANTHROPIC_API_KEY yet: runs use Harbor's simulator."}</p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {models.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModel(m.id)}
                className={cn("cursor-pointer rounded-lg border p-4 text-left transition-all", model === m.id ? "border-primary bg-primary-soft/50 ring-2 ring-primary/20" : "hover:bg-muted/40")}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{m.label}</span>
                  {model === m.id && <Check className="size-4 text-primary" />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{m.blurb}</p>
                <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                  ${m.inputPerM} / ${m.outputPerM} per 1M tokens
                </p>
              </button>
            ))}
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-6 p-6 animate-rise">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Set company policies</h2>
            <p className="mt-1 text-sm text-muted-foreground">Harbor enforces these on every agent in code, not just in the prompt. Agents can be stricter, never looser.</p>
          </div>
          <div>
            <Label>Actions that always need a manager&apos;s approval</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {catalog.map((t) => {
                const on = policies.approvalRequiredTools.includes(t.name);
                return (
                  <div key={t.name} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                    <Switch
                      checked={on}
                      onChange={(v) => setP("approvalRequiredTools", v ? [...policies.approvalRequiredTools, t.name] : policies.approvalRequiredTools.filter((x) => x !== t.name))}
                      label={`Require approval for ${t.label}`}
                    />
                    <span className="text-[13px]">{t.label}</span>
                    {on && <Lock className="ml-auto size-3.5 text-warning" />}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <NumberInput label="Max refund an agent may issue" prefix="$" value={policies.maxRefundUsd} onChange={(v) => setP("maxRefundUsd", v)} />
            <NumberInput label="Max model steps per run" value={policies.maxStepsPerRun} onChange={(v) => setP("maxStepsPerRun", Math.max(1, Math.round(v)))} />
            <NumberInput label="Max spend per run" prefix="$" step={0.05} value={policies.maxCostPerRunUsd} onChange={(v) => setP("maxCostPerRunUsd", v)} />
          </div>
          <div>
            <Label>Slack channels agents may post to</Label>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {policies.allowedSlackChannels.map((c) => (
                <Badge key={c} variant="primary" className="font-mono">
                  {c}
                  <button type="button" className="cursor-pointer" onClick={() => setP("allowedSlackChannels", policies.allowedSlackChannels.filter((x) => x !== c))} aria-label={`Remove ${c}`}>
                    <X />
                  </button>
                </Badge>
              ))}
              <form
                className="flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const c = `#${newChannel.replace(/^#/, "").toLowerCase().replace(/[^a-z0-9_-]/g, "-")}`;
                  if (c.length > 1 && !policies.allowedSlackChannels.includes(c)) setP("allowedSlackChannels", [...policies.allowedSlackChannels, c]);
                  setNewChannel("");
                }}
              >
                <Input value={newChannel} onChange={(e) => setNewChannel(e.target.value)} placeholder="#channel" className="h-7 w-32 font-mono text-xs" />
                <Button type="submit" size="sm" variant="ghost" className="h-7">
                  <Plus />
                </Button>
              </form>
            </div>
          </div>
          <div>
            <Label>Rules every agent follows</Label>
            <ul className="mt-2 space-y-1.5">
              {policies.rules.map((r, i) => (
                <li key={i} className="flex items-start gap-2 rounded-md border px-3 py-2 text-[13px]">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <span className="flex-1">{r}</span>
                  <button type="button" className="cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setP("rules", policies.rules.filter((_, j) => j !== i))} aria-label="Remove rule">
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (newRule.trim()) setP("rules", [...policies.rules, newRule.trim()]);
                setNewRule("");
              }}
            >
              <Input value={newRule} onChange={(e) => setNewRule(e.target.value)} placeholder="e.g. Never discuss competitor pricing." className="h-8 text-sm" />
              <Button type="submit" size="sm" variant="outline">
                Add
              </Button>
            </form>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-8 text-center animate-rise">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
            <Check className="size-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold tracking-tight">Workspace ready</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {connections.filter((c) => c.enabled).length} connections, {models.find((m) => m.id === model)?.label} as the default model, and {policies.rules.length + 3} policies. Every agent you create from now on inherits all of it.
          </p>
          <Button className="mt-6" size="lg" onClick={() => router.push("/agents/new")}>
            <Sparkles /> Create your first agent
          </Button>
        </Card>
      )}

      {step < 3 && (
        <div className="mt-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ArrowLeft /> Back
          </Button>
          <div className="flex items-center gap-2">
            {onboarded && step < 2 && (
              <Button variant="outline" onClick={() => save(false)} disabled={saving}>
                Save
              </Button>
            )}
            <Button onClick={next} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              {step === 2 ? "Save workspace" : "Continue"} <ArrowRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function NumberInput({ label, value, onChange, prefix, step = 1 }: { label: string; value: number; onChange: (v: number) => void; prefix?: string; step?: number }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-0.5">
        {prefix && <span className="text-muted-foreground">{prefix}</span>}
        <input type="number" step={step} min={0} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full bg-transparent text-lg font-semibold tabular-nums outline-none" />
      </div>
    </div>
  );
}

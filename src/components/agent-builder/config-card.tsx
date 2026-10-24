"use client";

import { Lock, Plus, ShieldCheck, X } from "lucide-react";
import { Badge, Card, Input, Label, Select, Switch, Textarea } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import type { AgentConfig } from "@/lib/engine/config";
import type { ModelInfo } from "@/lib/llm/models";
import type { ToolCatalogEntry } from "@/lib/queries";
import { cn } from "@/lib/utils";

export type BuilderWorkspace = {
  company: string;
  defaultModel: string;
  policies: { approvalRequiredTools: string[]; maxRefundUsd: number; maxStepsPerRun: number; maxCostPerRunUsd: number; allowedSlackChannels: string[]; rules: string[] };
  connections: { key: string; name: string; live: boolean; detail: string }[];
};

const CONNECTION_ORDER = ["ticket_inbox", "serpapi", "slack", "billing", "email"];

export function ConfigCard({
  config,
  onChange,
  catalog,
  models,
  workspace,
  readOnly,
}: {
  config: AgentConfig;
  onChange: (c: AgentConfig) => void;
  catalog: ToolCatalogEntry[];
  models: ModelInfo[];
  workspace: BuilderWorkspace;
  readOnly?: boolean;
}) {
  const set = <K extends keyof AgentConfig>(k: K, v: AgentConfig[K]) => onChange({ ...config, [k]: v });
  const setG = <K extends keyof AgentConfig["guardrails"]>(k: K, v: AgentConfig["guardrails"][K]) => onChange({ ...config, guardrails: { ...config.guardrails, [k]: v } });
  const policyRisky = new Set(workspace.policies.approvalRequiredTools);

  const toggleTool = (name: string, on: boolean) => {
    const allowedTools = on ? [...config.allowedTools, name] : config.allowedTools.filter((t) => t !== name);
    let riskyTools = config.riskyTools.filter((t) => allowedTools.includes(t));
    if (on && policyRisky.has(name) && !riskyTools.includes(name)) riskyTools = [...riskyTools, name];
    let allowedSlackChannels = config.guardrails.allowedSlackChannels;
    if (on && name === "post_slack_message" && !allowedSlackChannels.length) allowedSlackChannels = [workspace.policies.allowedSlackChannels[0]];
    onChange({ ...config, allowedTools, riskyTools, guardrails: { ...config.guardrails, allowedSlackChannels } });
  };
  const toggleRisky = (name: string, on: boolean) => set("riskyTools", on ? [...config.riskyTools, name] : config.riskyTools.filter((t) => t !== name));

  const grouped = CONNECTION_ORDER.map((key) => ({
    connection: workspace.connections.find((c) => c.key === key),
    tools: catalog.filter((t) => t.connection === key),
  })).filter((g) => g.tools.length);

  return (
    <Card className="overflow-hidden">
      {/* Identity */}
      <div className="grid gap-4 border-b bg-gradient-to-b from-primary-soft/60 to-card px-5 py-5 md:grid-cols-[1fr_240px]">
        <div className="space-y-2">
          <Input
            aria-label="Agent name"
            value={config.name}
            disabled={readOnly}
            onChange={(e) => set("name", e.target.value)}
            className="h-auto border-transparent bg-transparent px-0 text-xl font-semibold tracking-tight shadow-none focus-visible:border-transparent focus-visible:ring-0"
          />
          <Textarea
            aria-label="Description"
            value={config.description}
            disabled={readOnly}
            onChange={(e) => set("description", e.target.value)}
            className="min-h-0 resize-none border-transparent bg-transparent px-0 py-0 text-sm text-muted-foreground shadow-none focus-visible:border-transparent focus-visible:ring-0"
            rows={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="model">Model</Label>
          <Select id="model" value={config.model} disabled={readOnly} onChange={(e) => set("model", e.target.value)}>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
                {m.id === workspace.defaultModel ? " · default" : ""}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">{models.find((m) => m.id === config.model)?.blurb}</p>
        </div>
      </div>

      <div className="grid divide-y lg:grid-cols-[1.15fr_1fr] lg:divide-x lg:divide-y-0">
        {/* Instructions */}
        <section className="space-y-2 px-5 py-5">
          <div className="flex items-center justify-between">
            <Label htmlFor="instructions">Instructions</Label>
            <span className="text-xs text-muted-foreground">The agent follows these step by step</span>
          </div>
          <Textarea
            id="instructions"
            value={config.instructions}
            disabled={readOnly}
            onChange={(e) => set("instructions", e.target.value)}
            className="min-h-72 font-mono text-[12.5px] leading-6"
          />
          <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
            <div className="mb-1 font-medium text-foreground">Also applied from your workspace policy</div>
            <ul className="list-disc space-y-0.5 pl-4">
              {workspace.policies.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* Tools & guardrails */}
        <section className="space-y-6 px-5 py-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Tools &amp; permissions</Label>
              <span className="text-xs text-muted-foreground">{config.allowedTools.length} allowed</span>
            </div>
            <div className="space-y-3">
              {grouped.map(({ connection, tools }) => (
                <div key={connection?.key} className="rounded-lg border">
                  <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5 text-xs">
                    <span className={cn("size-1.5 rounded-full", connection?.live ? "bg-success" : "bg-muted-foreground/40")} />
                    <span className="font-medium">{connection?.name}</span>
                    <span className="ml-auto text-muted-foreground">{connection?.live ? "Connected" : "Simulated"}</span>
                  </div>
                  {tools.map((t) => {
                    const on = config.allowedTools.includes(t.name);
                    const locked = policyRisky.has(t.name);
                    const risky = config.riskyTools.includes(t.name);
                    return (
                      <div key={t.name} className={cn("flex items-start gap-3 px-3 py-2.5", !on && "opacity-60")}>
                        <Switch checked={on} disabled={readOnly} onChange={(v) => toggleTool(t.name, v)} label={`Allow ${t.label}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[13px] font-medium">{t.label}</span>
                            <code className="rounded bg-muted px-1 font-mono text-[11px] text-muted-foreground">{t.name}</code>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                        </div>
                        {on && (
                          <button
                            type="button"
                            disabled={readOnly || locked}
                            onClick={() => toggleRisky(t.name, !risky)}
                            title={locked ? "Required by workspace policy" : "Toggle manager approval"}
                            className={cn(
                              "flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                              risky ? "border-warning/30 bg-warning-soft text-warning" : "text-muted-foreground hover:bg-muted",
                              locked ? "cursor-not-allowed" : "cursor-pointer",
                            )}
                          >
                            {locked ? <Lock className="size-3" /> : <ShieldCheck className="size-3" />}
                            {risky ? "Needs approval" : "Auto"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Guardrails</Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <NumberField label="Max steps" value={config.guardrails.maxSteps} max={workspace.policies.maxStepsPerRun} step={1} disabled={readOnly} onChange={(v) => setG("maxSteps", v)} />
              <NumberField label="Budget / run" prefix="$" value={config.guardrails.maxCostUsd} max={workspace.policies.maxCostPerRunUsd} step={0.05} disabled={readOnly} onChange={(v) => setG("maxCostUsd", v)} />
              <NumberField label="Refund limit" prefix="$" value={config.guardrails.maxRefundUsd} max={workspace.policies.maxRefundUsd} step={10} disabled={readOnly} onChange={(v) => setG("maxRefundUsd", v)} />
            </div>
            {config.allowedTools.includes("post_slack_message") && (
              <div className="mt-3">
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">Slack channels it may post to</div>
                <div className="flex flex-wrap gap-1.5">
                  {workspace.policies.allowedSlackChannels.map((c) => {
                    const on = config.guardrails.allowedSlackChannels.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        disabled={readOnly}
                        onClick={() => setG("allowedSlackChannels", on ? config.guardrails.allowedSlackChannels.filter((x) => x !== c) : [...config.guardrails.allowedSlackChannels, c])}
                        className={cn(
                          "cursor-pointer rounded-full border px-2.5 py-0.5 font-mono text-xs transition-colors",
                          on ? "border-primary/30 bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <RulesEditor rules={config.guardrails.rules} disabled={readOnly} onChange={(r) => setG("rules", r)} />
          </div>
        </section>
      </div>
    </Card>
  );
}

function NumberField({
  label,
  value,
  onChange,
  max,
  step,
  prefix,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max: number;
  step: number;
  prefix?: string;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-lg border px-2.5 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-0.5">
        {prefix && <span className="text-sm text-muted-foreground">{prefix}</span>}
        <input
          type="number"
          value={value}
          min={0}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => onChange(Math.min(max, Number(e.target.value)))}
          className="w-full bg-transparent text-[15px] font-semibold tabular-nums outline-none"
        />
      </div>
      <div className="text-[10px] text-muted-foreground">
        max {prefix}
        {max}
      </div>
    </div>
  );
}

function RulesEditor({ rules, onChange, disabled }: { rules: string[]; onChange: (r: string[]) => void; disabled?: boolean }) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">Agent-specific rules</div>
      <div className="space-y-1.5">
        {rules.map((r, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input value={r} disabled={disabled} onChange={(e) => onChange(rules.map((x, j) => (j === i ? e.target.value : x)))} className="h-8 text-xs" />
            {!disabled && (
              <Button variant="ghost" size="icon" className="size-8" onClick={() => onChange(rules.filter((_, j) => j !== i))} aria-label="Remove rule">
                <X />
              </Button>
            )}
          </div>
        ))}
        {!disabled && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onChange([...rules, ""])}>
            <Plus /> Add rule
          </Button>
        )}
        {!rules.length && disabled && <Badge variant="outline">None</Badge>}
      </div>
    </div>
  );
}

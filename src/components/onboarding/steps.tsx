"use client";

import { useState } from "react";
import { Check, CreditCard, Globe2, Hash, Inbox, Loader2, Lock, Mail, Plus, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Input, Switch } from "@/components/ui/primitives";
import type { CompanyProfile, WorkspacePolicies } from "@/lib/db/schema";
import type { ModelInfo } from "@/lib/llm/models";
import type { ToolCatalogEntry } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Chip, FieldTitle, Slider } from "./controls";

export type Connection = { key: string; name: string; enabled: boolean; live: boolean; detail: string; envVar: string | null };
export type TestResult = { busy?: boolean; ok?: boolean; live?: boolean; message?: string };
type SetPolicy = <K extends keyof WorkspacePolicies>(k: K, v: WorkspacePolicies[K]) => void;

export const SIZES = ["1–10", "11–50", "51–200", "201–1,000", "1,000+"];
const KINDS = ["SaaS", "Scheduling & booking", "Healthcare", "eCommerce", "Fintech", "Marketplace", "Agency", "Education", "Travel", "Nonprofit", "Enterprise", "Startup"];
const CHANNEL_IDEAS = ["#support-urgent", "#support-billing", "#support-triage", "#incidents", "#general"];
const RULE_IDEAS = ["Always offer a human handoff when the customer asks.", "Reply in the customer's language.", "Never discuss competitor pricing."];

function TestNote({ t }: { t?: TestResult }) {
  if (!t?.message) return null;
  return (
    <div className={cn("mt-3 rounded-xl px-3 py-2 text-[13px]", t.ok ? (t.live ? "bg-success-soft text-success" : "bg-white/70 text-muted-foreground") : "bg-danger-soft text-danger")}>{t.message}</div>
  );
}

export function CompanyStep({ company, profile, onChange }: { company: string; profile: CompanyProfile; onChange: (p: CompanyProfile) => void }) {
  const i = Math.max(0, SIZES.indexOf(profile.size));
  return (
    <div className="space-y-8">
      <Slider id="company-size" label={`How large is ${company}?`} valueText={`${SIZES[i]} people`} min={0} max={SIZES.length - 1} value={i} onChange={(v) => onChange({ ...profile, size: SIZES[v] })} />
      <div>
        <FieldTitle>What kind of company are you?</FieldTitle>
        <div className="flex flex-wrap gap-2.5">
          {KINDS.map((k) => {
            const on = profile.kinds.includes(k);
            return (
              <Chip key={k} selected={on} onClick={() => onChange({ ...profile, kinds: on ? profile.kinds.filter((x) => x !== k) : [...profile.kinds, k] })}>
                {k}
              </Chip>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const CONNECTION_ICONS: Record<string, React.ElementType> = { ticket_inbox: Inbox, serpapi: Globe2, slack: Hash, billing: CreditCard, email: Mail };

export function ToolsStep({
  connections,
  onToggle,
  tests,
  onTest,
}: {
  connections: Connection[];
  onToggle: (key: string, enabled: boolean) => void;
  tests: Record<string, TestResult>;
  onTest: (key: string) => void;
}) {
  return (
    <ul className="space-y-3">
      {connections.map((c) => {
        const Icon = CONNECTION_ICONS[c.key] ?? Globe2;
        const t = tests[c.key];
        return (
          <li key={c.key} className="rounded-2xl border border-white/80 bg-white/55 px-4 py-3.5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-[0_1px_2px_rgba(16,24,40,0.08)]">
                <Icon className="size-[18px]" strokeWidth={1.9} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                  {c.name}
                  {c.live ? <Badge variant="success">Live</Badge> : <Badge variant="outline">Simulated</Badge>}
                </div>
                <div className="text-[13px] text-muted-foreground">{c.detail}</div>
              </div>
              {(c.key === "serpapi" || c.key === "slack") && (
                <Button size="sm" variant="outline" onClick={() => onTest(c.key)} disabled={t?.busy}>
                  {t?.busy && <Loader2 className="animate-spin" />} Test
                </Button>
              )}
              <Switch checked={c.enabled} onChange={(v) => onToggle(c.key, v)} label={`Let agents use ${c.name}`} />
            </div>
            <TestNote t={t} />
          </li>
        );
      })}
    </ul>
  );
}

export function ModelStep({ models, model, onChange, test, onTest }: { models: ModelInfo[]; model: string; onChange: (m: string) => void; test?: TestResult; onTest: () => void }) {
  return (
    <div>
      <div role="radiogroup" aria-label="Default model" className="grid gap-3 sm:grid-cols-3">
        {models.map((m) => {
          const on = model === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(m.id)}
              className={cn(
                "cursor-pointer rounded-2xl border p-4 text-left transition-all",
                on ? "border-foreground bg-white shadow-sm ring-1 ring-foreground" : "border-white/80 bg-white/45 hover:bg-white/70",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-semibold">{m.label}</span>
                {on && <Check className="size-4" />}
              </div>
              <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{m.blurb}</p>
              <p className="mt-3 text-[12px] text-muted-foreground tabular-nums">
                ${m.inputPerM} / ${m.outputPerM} per 1M tokens
              </p>
            </button>
          );
        })}
      </div>
      <Button size="sm" variant="outline" className="mt-5" onClick={onTest} disabled={test?.busy}>
        {test?.busy && <Loader2 className="animate-spin" />} Test this model
      </Button>
      <TestNote t={test} />
    </div>
  );
}

export function ApprovalsStep({ catalog, policies, setP }: { catalog: ToolCatalogEntry[]; policies: WorkspacePolicies; setP: SetPolicy }) {
  const toggle = (name: string) =>
    setP("approvalRequiredTools", policies.approvalRequiredTools.includes(name) ? policies.approvalRequiredTools.filter((x) => x !== name) : [...policies.approvalRequiredTools, name]);
  const groups = [
    { title: "Risky actions", tools: catalog.filter((t) => t.risky) },
    { title: "Everyday actions", tools: catalog.filter((t) => !t.risky) },
  ];
  return (
    <div className="space-y-7">
      {groups.map((g) => (
        <div key={g.title}>
          <FieldTitle>{g.title}</FieldTitle>
          <div className="flex flex-wrap gap-2.5">
            {g.tools.map((t) => {
              const on = policies.approvalRequiredTools.includes(t.name);
              return (
                <Chip key={t.name} selected={on} onClick={() => toggle(t.name)} className="inline-flex items-center gap-1.5">
                  {on && <Lock className="size-3.5" />}
                  {t.label}
                </Chip>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function LimitsStep({ policies, setP }: { policies: WorkspacePolicies; setP: SetPolicy }) {
  return (
    <div className="space-y-8">
      <Slider
        id="max-refund"
        label="Largest refund an agent may issue"
        valueText={`$${policies.maxRefundUsd}`}
        min={0}
        max={Math.max(500, policies.maxRefundUsd)}
        step={10}
        value={policies.maxRefundUsd}
        onChange={(v) => setP("maxRefundUsd", v)}
      />
      <Slider
        id="max-steps"
        label="Model steps per run"
        valueText={`${policies.maxStepsPerRun} steps`}
        min={1}
        max={Math.max(30, policies.maxStepsPerRun)}
        value={policies.maxStepsPerRun}
        onChange={(v) => setP("maxStepsPerRun", Math.round(v))}
      />
      <Slider
        id="max-cost"
        label="Spend per run"
        valueText={`$${policies.maxCostPerRunUsd.toFixed(2)}`}
        min={0.05}
        max={Math.max(2, policies.maxCostPerRunUsd)}
        step={0.05}
        value={policies.maxCostPerRunUsd}
        onChange={(v) => setP("maxCostPerRunUsd", Math.round(v * 100) / 100)}
      />
    </div>
  );
}

/** Small inline form: an input and an Add button that submits on Enter. */
function AddInline({ placeholder, onAdd, mono }: { placeholder: string; onAdd: (v: string) => void; mono?: boolean }) {
  const [v, setV] = useState("");
  return (
    <form
      className="mt-4 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onAdd(v.trim());
        setV("");
      }}
    >
      <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className={cn("border-white/80 bg-white/60", mono && "font-mono text-[14px]")} />
      <Button type="submit" variant="outline" size="lg" className="shrink-0">
        <Plus /> Add
      </Button>
    </form>
  );
}

export function SlackStep({ policies, setP }: { policies: WorkspacePolicies; setP: SetPolicy }) {
  const channels = policies.allowedSlackChannels;
  const all = [...channels, ...CHANNEL_IDEAS.filter((c) => !channels.includes(c))];
  return (
    <div>
      <div className="flex flex-wrap gap-2.5">
        {all.map((c) => {
          const on = channels.includes(c);
          return (
            <Chip key={c} selected={on} onClick={() => setP("allowedSlackChannels", on ? channels.filter((x) => x !== c) : [...channels, c])} className="font-mono text-[13px]">
              {c}
            </Chip>
          );
        })}
      </div>
      <AddInline
        mono
        placeholder="#channel-name"
        onAdd={(raw) => {
          const c = `#${raw.replace(/^#/, "").toLowerCase().replace(/[^a-z0-9_-]/g, "-")}`;
          if (c.length > 1 && !channels.includes(c)) setP("allowedSlackChannels", [...channels, c]);
        }}
      />
    </div>
  );
}

export function RulesStep({ policies, setP }: { policies: WorkspacePolicies; setP: SetPolicy }) {
  const rules = policies.rules;
  const ideas = RULE_IDEAS.filter((r) => !rules.includes(r));
  return (
    <div>
      <ul className="space-y-2">
        {rules.map((r, i) => (
          <li key={`${i}-${r}`} className="flex items-start gap-3 rounded-2xl border border-white/80 bg-white/55 px-4 py-3 text-[14px]">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <span className="flex-1">{r}</span>
            <button
              type="button"
              aria-label={`Remove rule: ${r}`}
              className="cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={() => setP("rules", rules.filter((_, j) => j !== i))}
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      {ideas.length > 0 && (
        <div className="mt-5">
          <FieldTitle>Ideas</FieldTitle>
          <div className="flex flex-wrap gap-2.5">
            {ideas.map((r) => (
              <Chip key={r} selected={false} onClick={() => setP("rules", [...rules, r])} className="inline-flex items-center gap-1.5">
                <Plus className="size-3.5" /> {r}
              </Chip>
            ))}
          </div>
        </div>
      )}
      <AddInline placeholder="e.g. Never promise delivery dates." onAdd={(r) => setP("rules", [...rules, r])} />
    </div>
  );
}

export function Summary({ rows, onEdit }: { rows: { step: string; label: string; value: string }[]; onEdit: (step: string) => void }) {
  return (
    <ul className="divide-y divide-black/[0.06]">
      {rows.map((r) => (
        <li key={r.step} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">{r.label}</div>
            <div className="mt-0.5 text-[15px] font-medium">{r.value}</div>
          </div>
          <Button size="sm" variant="outline" onClick={() => onEdit(r.step)} aria-label={`Edit ${r.label}`}>
            Edit
          </Button>
        </li>
      ))}
    </ul>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { AmbientGlow } from "@/components/ambient-glow";
import { Mascot } from "@/components/mascots/mascot";
import { SpeechBubble } from "@/components/mascots/speech-bubble";
import { Button } from "@/components/ui/button";
import type { CompanyProfile, WorkspacePolicies } from "@/lib/db/schema";
import type { ModelInfo } from "@/lib/llm/models";
import { ALL_MASCOTS, type MascotKind } from "@/lib/mascots";
import type { ToolCatalogEntry } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { ApprovalsStep, CompanyStep, LimitsStep, ModelStep, RulesStep, SIZES, SlackStep, Summary, ToolsStep, type Connection, type TestResult } from "./steps";

const STEPS = ["welcome", "company", "tools", "model", "approvals", "limits", "slack", "rules", "done"] as const;
type StepId = (typeof STEPS)[number];
const QUESTIONS = STEPS.slice(1, -1);

const GUIDE: Record<StepId, MascotKind[]> = {
  welcome: ALL_MASCOTS,
  company: ["orbit"],
  tools: ["facet"],
  model: ["murmur"],
  approvals: ["orbit"],
  limits: ["facet"],
  slack: ["murmur"],
  rules: ["orbit"],
  done: ALL_MASCOTS,
};

type Props = {
  company: string;
  ownerName: string;
  connections: Connection[];
  models: ModelInfo[];
  defaultModel: string;
  policies: WorkspacePolicies;
  catalog: ToolCatalogEntry[];
  llmLive: boolean;
  onboarded: boolean;
};

/**
 * Duolingo-style workspace setup: one question per screen, with a glass mascot guiding each step.
 * Everything saved here (connections, model, policies, company profile) is inherited by every agent.
 */
export function OnboardingFlow(props: Props) {
  const { company, models, catalog, llmLive } = props;
  const router = useRouter();
  const [step, setStep] = useState<StepId>(props.onboarded ? "done" : "welcome");
  const [editing, setEditing] = useState(false);
  const [cue, setCue] = useState(0);
  const [profile, setProfile] = useState<CompanyProfile>(props.policies.profile ?? { size: SIZES[1], kinds: [] });
  const [connections, setConnections] = useState(props.connections);
  const [model, setModel] = useState(props.defaultModel);
  const [policies, setPolicies] = useState(props.policies);
  const [tests, setTests] = useState<Record<string, TestResult>>({});
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(props.onboarded);
  // Captured once: router.refresh() after saving flips props.onboarded to true.
  const [firstRun] = useState(!props.onboarded);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const first = props.ownerName.split(" ")[0];
  const q = QUESTIONS.indexOf(step as (typeof QUESTIONS)[number]);
  const multi = GUIDE[step].length > 1;

  function go(s: StepId) {
    setStep(s);
    setCue((c) => c + 1);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const touch = () => setDirty(true);
  const setP = <K extends keyof WorkspacePolicies>(k: K, v: WorkspacePolicies[K]) => {
    setPolicies((p) => ({ ...p, [k]: v }));
    touch();
  };

  async function test(key: string, body?: unknown) {
    setTests((t) => ({ ...t, [key]: { busy: true } }));
    const res = await fetch(`/api/connections/${key}/test`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
    const data = (await res.json().catch(() => ({ ok: false, message: `Test failed (${res.status})` }))) as TestResult;
    setTests((t) => ({ ...t, [key]: data }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/workspace", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        defaultModel: model,
        policies: { ...policies, profile },
        enabledConnections: Object.fromEntries(connections.map((c) => [c.key, c.enabled])),
        complete: true,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? `Could not save (${res.status})`);
      return false;
    }
    setDirty(false);
    setSaved(true);
    router.refresh();
    return true;
  }

  /** Back to the summary, saving any edits on the way. */
  async function toSummary() {
    if (dirty && !(await save())) return;
    setEditing(false);
    go("done");
  }

  async function next() {
    if (step === "done" || saving) return;
    if (editing || step === "rules") return toSummary();
    go(STEPS[STEPS.indexOf(step) + 1]);
  }
  function back() {
    if (editing) return toSummary();
    if (step !== "welcome") go(STEPS[STEPS.indexOf(step) - 1]);
  }
  function exit() {
    if (dirty && !confirm("Leave setup? Your changes aren't saved yet.")) return;
    router.push("/dashboard");
  }

  // Enter continues and Esc leaves, unless the user is typing in a field.
  const keys = useRef({ next, exit });
  useEffect(() => {
    keys.current = { next, exit };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, button, [role=radio], a")) return;
      if (e.key === "Enter") keys.current.next();
      if (e.key === "Escape") keys.current.exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const enabled = connections.filter((c) => c.enabled);
  const label = (name: string) => catalog.find((t) => t.name === name)?.label ?? name;
  const screens: Record<StepId, { line: React.ReactNode; title: string; subtitle: string; body?: React.ReactNode; cta?: string }> = {
    welcome: {
      line: (
        <>
          Hi {first}! We&apos;ll be your guides. Let&apos;s set up {company}&apos;s workspace together. It takes about two minutes.
        </>
      ),
      title: "Welcome to Harbor",
      subtitle: "Set things up once. Every agent your team builds afterwards inherits it: tools, model, approvals and guardrails.",
      cta: "Let's go",
    },
    company: {
      line: "First, a little about you. Agents use this to sound like your team.",
      title: `Can you tell us about ${company}?`,
      subtitle: "Harbor works for tiny teams and big support orgs alike.",
      body: (
        <CompanyStep
          company={company}
          profile={profile}
          onChange={(p) => {
            setProfile(p);
            touch();
          }}
        />
      ),
    },
    tools: {
      line: "These are the tools your agents can reach. Secrets stay in your environment, never in the database.",
      title: "Which tools can your agents use?",
      subtitle: "Turn off anything you don't want agents to touch. Test a connection to see it work.",
      body: (
        <ToolsStep
          connections={connections}
          tests={tests}
          onTest={(key) => test(key)}
          onToggle={(key, v) => {
            setConnections((cs) => cs.map((c) => (c.key === key ? { ...c, enabled: v } : c)));
            touch();
          }}
        />
      ),
    },
    model: {
      line: "I'm the writer of the crew. Pick the model that does the thinking; each agent can still choose its own.",
      title: "Pick a default model",
      subtitle: llmLive ? "Your Anthropic key is connected." : "No Anthropic key yet, so runs use Harbor's simulator until you add one.",
      body: (
        <ModelStep
          models={models}
          model={model}
          onChange={(m) => {
            setModel(m);
            touch();
          }}
          test={tests.model}
          onTest={() => test("model", { model })}
        />
      ),
    },
    approvals: {
      line: "Before any of these, I'll pause the agent and ask a manager in Slack.",
      title: "Which actions need a manager's OK?",
      subtitle: "Harbor enforces this in code, not just in the prompt. Agents can ask for more approvals, never fewer.",
      body: <ApprovalsStep catalog={catalog} policies={policies} setP={setP} />,
    },
    limits: {
      line: "Guardrails keep every run small and safe, whatever the agent decides.",
      title: "Set the guardrails",
      subtitle: "Agents can be stricter than this, never looser. Anything over the refund limit goes to a person.",
      body: <LimitsStep policies={policies} setP={setP} />,
    },
    slack: {
      line: "Agents may only post where you say. I'll keep the messages short.",
      title: "Where may agents post in Slack?",
      subtitle: "Tap a channel to switch it on or off, or add your own.",
      body: <SlackStep policies={policies} setP={setP} />,
    },
    rules: {
      line: "Last one! House rules go into every agent's instructions, word for word.",
      title: "Any house rules?",
      subtitle: "Plain English works best. You can change these any time.",
      body: <RulesStep policies={policies} setP={setP} />,
      cta: editing ? undefined : "Save workspace",
    },
    done: {
      line: saved && firstRun ? `All set, ${first}! Your first agent is a sentence away.` : "Here's everything your agents inherit. Tap Edit to change any part.",
      title: saved && firstRun ? `${company} is ready` : `${company} workspace`,
      subtitle: "Every agent you create inherits all of this.",
      body: (
        <Summary
          onEdit={(s) => {
            setEditing(true);
            go(s as StepId);
          }}
          rows={[
            { step: "company", label: "Company", value: `${profile.size} people${profile.kinds.length ? ` · ${profile.kinds.join(", ")}` : ""}` },
            { step: "tools", label: "Tools", value: `${enabled.length} of ${connections.length} on${enabled.length ? `: ${enabled.map((c) => c.name).join(", ")}` : ""}` },
            { step: "model", label: "Default model", value: models.find((m) => m.id === model)?.label ?? model },
            { step: "approvals", label: "Needs a manager's OK", value: policies.approvalRequiredTools.map(label).join(", ") || "Nothing" },
            {
              step: "limits",
              label: "Guardrails",
              value: `Refunds up to $${policies.maxRefundUsd} · ${policies.maxStepsPerRun} steps · $${policies.maxCostPerRunUsd.toFixed(2)} per run`,
            },
            { step: "slack", label: "Slack channels", value: policies.allowedSlackChannels.join(", ") || "None" },
            { step: "rules", label: "House rules", value: `${policies.rules.length} ${policies.rules.length === 1 ? "rule" : "rules"}` },
          ]}
        />
      ),
    },
  };
  const s = screens[step];

  return (
    <div className="relative min-h-screen pb-16">
      <AmbientGlow />
      <div className="mx-auto max-w-[720px] px-5">
        <header className="flex items-center gap-4 pt-6">
          <button type="button" onClick={exit} aria-label="Leave setup" className="glass flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-105">
            <X className="size-5" />
          </button>
          <div
            role="progressbar"
            aria-label="Setup progress"
            aria-valuemin={0}
            aria-valuemax={QUESTIONS.length}
            aria-valuenow={step === "done" ? QUESTIONS.length : Math.max(0, q)}
            className="h-3 flex-1 overflow-hidden rounded-full bg-black/[0.07]"
          >
            <div
              className="h-full rounded-full bg-foreground transition-[width] duration-500 ease-out"
              style={{ width: `${step === "done" ? 100 : step === "welcome" ? 3 : ((q + 1) / QUESTIONS.length) * 100}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-[13px] font-semibold text-muted-foreground tabular-nums">
            {q >= 0 ? `${q + 1} / ${QUESTIONS.length}` : step === "done" ? "Done" : ""}
          </span>
        </header>

        {/* Same tree on every step so the mascot canvas stays mounted and just hops to the next guide. */}
        <section className={cn("mt-8 flex gap-4", multi ? "flex-col items-center" : "items-center sm:gap-6")}>
          <Mascot kinds={GUIDE[step]} width={multi ? 350 : 168} height={multi ? 200 : 168} cue={cue} interactive />
          <SpeechBubble key={step} tail={multi ? "top" : "left"} className={cn("animate-rise", multi ? "max-w-[520px] text-center" : "flex-1")}>
            {s.line}
          </SpeechBubble>
        </section>

        <div key={step} className="mt-9 animate-rise">
          <h1 className="display text-[30px] sm:text-[34px]">{s.title}</h1>
          <p className="mt-2 max-w-[600px] text-[16px] leading-relaxed text-muted-foreground">{s.subtitle}</p>
          {s.body && <div className="glass mt-7 rounded-[24px] p-5 sm:p-7">{s.body}</div>}
          {error && <p className="mt-4 rounded-xl bg-danger-soft px-4 py-2.5 text-[14px] text-danger">{error}</p>}

          {step === "done" ? (
            <footer className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <Button variant="ghost" className="rounded-full" onClick={() => go("welcome")}>
                <RotateCcw /> Replay setup
              </Button>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" size="lg" className="rounded-full px-6" onClick={() => router.push("/dashboard")}>
                  Go to Home
                </Button>
                <Button size="lg" className="rounded-full px-7" onClick={() => router.push("/agents/new")}>
                  <Sparkles /> Create {saved && firstRun ? "your first" : "an"} agent
                </Button>
              </div>
            </footer>
          ) : (
            <footer className="mt-8 flex items-center justify-between gap-3">
              {step !== "welcome" ? (
                <Button variant="outline" size="lg" className="rounded-full px-6" onClick={back} disabled={saving}>
                  <ArrowLeft /> {editing ? "Back to summary" : "Go back"}
                </Button>
              ) : (
                <span />
              )}
              <Button size="lg" className="rounded-full px-8" onClick={next} disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                {editing ? "Save" : (s.cta ?? "Continue")}
              </Button>
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { AgentLibrary, type LibraryItem } from "@/components/agent-library";
import { OrbField } from "@/components/agent-orb";
import { Button } from "@/components/ui/button";
import { agentCategory, agentTags } from "@/lib/agent-meta";
import { listAgents, listTemplates } from "@/lib/queries";
import { getWorkspace } from "@/lib/seed";
import { pct } from "@/lib/utils";

export default async function AgentLibraryPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const [agents, templates, ws] = await Promise.all([listAgents(), listTemplates(), getWorkspace()]);

  const items: LibraryItem[] = [
    ...agents.map(({ agent, template, stats }) => ({
      kind: "agent" as const,
      id: agent.id,
      name: agent.name,
      description: template.description,
      category: agentCategory(agent.name, template.description, template.allowedTools),
      tags: agentTags(template.allowedTools),
      approvals: template.riskyTools.length,
      status: agent.status,
      runs: stats.runs,
      handledPct: pct(stats.handled, stats.runs),
    })),
    ...templates.map((t) => ({
      kind: "template" as const,
      id: t.id,
      name: t.name,
      description: t.description,
      category: agentCategory(t.name, t.description, t.allowedTools),
      tags: agentTags(t.allowedTools),
      approvals: t.riskyTools.length,
      source: t.builtin ? ("starter" as const) : ("team" as const),
    })),
  ];
  const live = agents.filter((a) => a.agent.status === "live").length;

  return (
    <>
      <section className="relative mb-12 overflow-hidden rounded-[28px] bg-[#141414] px-6 py-16 text-center md:py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(255,255,255,0.07),transparent_70%)]" />
        <OrbField />
        <div className="relative mx-auto max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1 text-xs text-white/70">
            <span className="size-1.5 rounded-full bg-success" />
            {ws.company} workspace · {live} live {live === 1 ? "agent" : "agents"} · {ws.policies.rules.length + 3} policies enforced
          </div>
          <h1 className="display text-[34px] text-white md:text-[46px]">Agents for every support workflow.</h1>
          <p className="display text-[34px] text-white/45 md:text-[46px]">Described in a sentence, safe to deploy.</p>
          <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-white/60">
            Start from a template your team trusts, or describe a new job. Every agent inherits your workspace&apos;s tools, model and policies, and every
            action it takes is logged.
          </p>
          <div className="mt-8 flex justify-center gap-2.5">
            <Button variant="inverse" asChild>
              <Link href="/agents/new">Describe an agent</Link>
            </Button>
            <Button variant="inverse-muted" asChild>
              <Link href="/agents?view=templates">Browse templates</Link>
            </Button>
          </div>
        </div>
      </section>

      <AgentLibrary key={view ?? "all"} items={items} initialView={view === "templates" ? "templates" : view === "agents" ? "agents" : "all"} />
    </>
  );
}

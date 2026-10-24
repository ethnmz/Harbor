import Link from "next/link";
import { Plus } from "lucide-react";
import { AgentLibrary, type LibraryItem } from "@/components/agent-library";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/primitives";
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
      <PageHeader
        title="Agents"
        description={`Your agents and the templates your team can start from. Every agent inherits ${ws.company}'s tools, model and policies. ${live} live now.`}
        actions={
          <Button asChild>
            <Link href="/agents/new">
              <Plus /> New agent
            </Link>
          </Button>
        }
      />

      <AgentLibrary key={view ?? "all"} items={items} initialView={view === "templates" ? "templates" : view === "agents" ? "agents" : "all"} />
    </>
  );
}

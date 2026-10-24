import Link from "next/link";
import { notFound } from "next/navigation";
import { RunTimeline } from "@/components/run/timeline";
import { PageHeader } from "@/components/ui/primitives";
import { toJson } from "@/lib/json";
import { getRunDetail } from "@/lib/queries";
import { AgentOrb } from "@/components/agent-orb";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getRunDetail(id);
  if (!detail) notFound();
  return (
    <>
      <PageHeader
        eyebrow={
          <span>
            <Link href={`/agents/${detail.agent.id}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
              <AgentOrb seed={detail.agent.name} size={12} />
              {detail.agent.name}
            </Link>{" "}
            / Run <span className="font-mono">{detail.run.id.slice(0, 8)}</span>
          </span>
        }
        title={detail.ticket ? detail.ticket.subject : "Run"}
        description="Step-by-step timeline: what the agent thought, which tools it called, what came back, and who approved what."
      />
      <RunTimeline initial={toJson(detail)} />
    </>
  );
}

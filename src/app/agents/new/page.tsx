import { AgentBuilder } from "@/components/agent-builder/builder";
import { PageHeader } from "@/components/ui/primitives";
import { builderProps, draftProps } from "@/lib/page-data";
import { getWorkspace } from "@/lib/seed";

export default async function NewAgentPage({ searchParams }: { searchParams: Promise<{ draft?: string; prompt?: string }> }) {
  const { draft, prompt } = await searchParams;
  const ws = await getWorkspace();
  const [props, draftData] = await Promise.all([builderProps(ws), draft ? draftProps(draft) : undefined]);
  return (
    <>
      <PageHeader
        title={draftData ? `Set up ${draftData.config.name}` : "Create an agent"}
        description="From a plain-English job description to a tested, policy-safe agent in about a minute."
      />
      <AgentBuilder key={draft ?? prompt ?? "new"} {...props} draft={draftData} initialPrompt={prompt?.slice(0, 2000)} />
    </>
  );
}

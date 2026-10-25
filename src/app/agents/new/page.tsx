import { AgentBuilder } from "@/components/agent-builder/builder";
import { builderProps, draftProps } from "@/lib/page-data";
import { getWorkspace } from "@/lib/seed";

/** Full-screen, step-by-step agent setup, outside the app shell like onboarding. */
export default async function NewAgentPage({ searchParams }: { searchParams: Promise<{ draft?: string; prompt?: string }> }) {
  const { draft, prompt } = await searchParams;
  const ws = await getWorkspace();
  const [props, draftData] = await Promise.all([builderProps(ws), draft ? draftProps(draft) : undefined]);
  return <AgentBuilder key={draft ?? prompt ?? "new"} {...props} draft={draftData} initialPrompt={prompt?.slice(0, 2000)} />;
}

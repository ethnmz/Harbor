import { eq } from "drizzle-orm";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { PageHeader } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { tools } from "@/lib/db/schema";
import { getProvider } from "@/lib/llm";
import { MODELS } from "@/lib/llm/models";
import { TOOL_CATALOG } from "@/lib/queries";
import { getWorkspace } from "@/lib/seed";
import { connectionStatus, type ConnectionKey } from "@/lib/tools";

const ENV_VARS: Record<string, string | null> = { serpapi: "SERPAPI_API_KEY", slack: "SLACK_WEBHOOK_URL", ticket_inbox: null, billing: null, email: null };

export default async function OnboardingPage() {
  const ws = await getWorkspace();
  const conns = await db.select().from(tools).where(eq(tools.workspaceId, ws.id));
  return (
    <>
      <PageHeader
        eyebrow={ws.onboardedAt ? "Workspace settings" : "Welcome to Harbor"}
        title={ws.onboardedAt ? `${ws.company} workspace` : `Set up ${ws.company}'s workspace`}
        description="Connections, model and policies are configured once here. Every agent reuses them, so the team can focus on what each agent should accomplish."
      />
      <OnboardingWizard
        company={ws.company}
        connections={conns.map((c) => ({ key: c.key, name: c.name, enabled: c.enabled, envVar: ENV_VARS[c.key] ?? null, ...connectionStatus(c.key as ConnectionKey) }))}
        models={MODELS}
        defaultModel={ws.defaultModel}
        policies={ws.policies}
        catalog={TOOL_CATALOG}
        llmLive={getProvider().live}
        onboarded={Boolean(ws.onboardedAt)}
      />
    </>
  );
}

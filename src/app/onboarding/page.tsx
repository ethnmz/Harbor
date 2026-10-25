import { eq } from "drizzle-orm";
import { OnboardingFlow } from "@/components/onboarding/flow";
import { db } from "@/lib/db";
import { tools } from "@/lib/db/schema";
import { getProvider } from "@/lib/llm";
import { MODELS } from "@/lib/llm/models";
import { TOOL_CATALOG } from "@/lib/queries";
import { getWorkspace } from "@/lib/seed";
import { connectionStatus, type ConnectionKey } from "@/lib/tools";

const ENV_VARS: Record<string, string | null> = { serpapi: "SERPAPI_API_KEY", slack: "SLACK_WEBHOOK_URL", ticket_inbox: null, billing: null, email: null };

/** Full-screen setup, outside the app shell (see app/(workspace)/layout.tsx). */
export default async function OnboardingPage() {
  const ws = await getWorkspace();
  const conns = await db.select().from(tools).where(eq(tools.workspaceId, ws.id));
  return (
    <OnboardingFlow
      company={ws.company}
      ownerName={ws.ownerName}
      connections={conns.map((c) => ({ key: c.key, name: c.name, enabled: c.enabled, envVar: ENV_VARS[c.key] ?? null, ...connectionStatus(c.key as ConnectionKey) }))}
      models={MODELS}
      defaultModel={ws.defaultModel}
      policies={ws.policies}
      catalog={TOOL_CATALOG}
      llmLive={getProvider().live}
      onboarded={Boolean(ws.onboardedAt)}
    />
  );
}

import { eq } from "drizzle-orm";
import { db } from "./db";
import { templates, tools, type Workspace } from "./db/schema";
import { getProvider } from "./llm";
import { MODELS } from "./llm/models";
import { TOOL_CATALOG, getAgent } from "./queries";
import { connectionStatus, type ConnectionKey } from "./tools";
import { configFromTemplate } from "./engine/config";

/** Everything the agent builder needs from the server. */
export async function builderProps(ws: Workspace) {
  const conns = await db.select().from(tools).where(eq(tools.workspaceId, ws.id));
  const enabled = new Set(conns.filter((c) => c.enabled).map((c) => c.key));
  return {
    catalog: TOOL_CATALOG.filter((t) => enabled.has(t.connection)),
    models: MODELS,
    llmLive: getProvider().live,
    workspace: {
      company: ws.company,
      defaultModel: ws.defaultModel,
      policies: ws.policies,
      connections: conns
        .filter((c) => c.enabled)
        .map((c) => ({ key: c.key, name: c.name, ...connectionStatus(c.key as ConnectionKey) })),
    },
  };
}

export async function draftProps(agentId: string) {
  const row = await getAgent(agentId);
  if (!row) return undefined;
  let sourceName: string | null = null;
  if (row.template.sourceTemplateId) {
    const [src] = await db.select({ name: templates.name }).from(templates).where(eq(templates.id, row.template.sourceTemplateId));
    sourceName = src?.name ?? null;
  }
  return { agentId: row.agent.id, config: configFromTemplate(row.template), prompt: row.template.prompt, sourceName, status: row.agent.status };
}

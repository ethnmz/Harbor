import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { route } from "@/lib/api";
import { audit, HUMAN_ACTOR } from "@/lib/audit";
import { db } from "@/lib/db";
import { templates } from "@/lib/db/schema";
import { createAgent } from "@/lib/engine/agents";
import { configFromTemplate } from "@/lib/engine/config";
import { getWorkspace } from "@/lib/seed";

type Ctx = { params: Promise<{ id: string }> };

/** Start a new draft agent from a gallery template. */
export const POST = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const [t] = await db.select().from(templates).where(eq(templates.id, id));
  if (!t) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  const ws = await getWorkspace();
  const { agent, adjustments } = await createAgent(ws, configFromTemplate(t), { prompt: t.prompt, sourceTemplateId: t.id });
  await audit(HUMAN_ACTOR, "template.used", t.id, { name: t.name, agent: agent.id }, ws.id);
  return NextResponse.json({ agentId: agent.id, adjustments });
});

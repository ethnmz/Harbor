import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { route } from "@/lib/api";
import { audit, HUMAN_ACTOR } from "@/lib/audit";
import { db } from "@/lib/db";
import { tools, workspaces } from "@/lib/db/schema";
import { MODELS } from "@/lib/llm/models";
import { getWorkspace } from "@/lib/seed";

const body = z.object({
  defaultModel: z.string().refine((m) => MODELS.some((x) => x.id === m)),
  policies: z.object({
    approvalRequiredTools: z.array(z.string()),
    maxRefundUsd: z.number().min(0).max(100000),
    maxStepsPerRun: z.number().int().min(1).max(50),
    maxCostPerRunUsd: z.number().min(0.01).max(100),
    allowedSlackChannels: z.array(z.string().regex(/^#[a-z0-9_-]+$/)),
    rules: z.array(z.string().min(1)),
    profile: z.object({ size: z.string().min(1).max(40), kinds: z.array(z.string().min(1).max(40)).max(12) }).optional(),
  }),
  enabledConnections: z.record(z.string(), z.boolean()).optional(),
  complete: z.boolean().optional(),
});

export const PATCH = route(async (req) => {
  const input = body.parse(await req.json());
  const ws = await getWorkspace();
  const [updated] = await db
    .update(workspaces)
    .set({ defaultModel: input.defaultModel, policies: input.policies, ...(input.complete ? { onboardedAt: ws.onboardedAt ?? new Date() } : {}) })
    .where(eq(workspaces.id, ws.id))
    .returning();
  for (const [key, enabled] of Object.entries(input.enabledConnections ?? {}))
    await db.update(tools).set({ enabled }).where(and(eq(tools.workspaceId, ws.id), eq(tools.key, key)));
  await audit(HUMAN_ACTOR, input.complete ? "workspace.onboarded" : "workspace.updated", ws.id, { defaultModel: input.defaultModel, policies: input.policies }, ws.id);
  return NextResponse.json({ workspace: updated });
});

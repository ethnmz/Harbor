import { db } from "./db";
import { auditLog } from "./db/schema";

export const HUMAN_ACTOR = "maya@tidewell.app";

export async function audit(actor: string, action: string, target: string | null, details: Record<string, unknown> = {}, workspaceId?: string) {
  await db.insert(auditLog).values({ actor, action, target, details, workspaceId: workspaceId ?? null });
}

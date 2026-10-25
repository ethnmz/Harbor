import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { HUMAN_ACTOR } from "@/lib/audit";
import { activateVersion } from "@/lib/engine/versions";
import { getWorkspace } from "@/lib/seed";

type Ctx = { params: Promise<{ id: string; version: string }> };

/** Roll the agent back (or forward) to an existing version. */
export const POST = route<Ctx>(async (_req, { params }) => {
  const { id, version } = await params;
  const row = await activateVersion(await getWorkspace(), id, Number(version), HUMAN_ACTOR);
  return NextResponse.json({ ok: true, version: row.version });
});

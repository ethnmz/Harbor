import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { getRedTeam } from "@/lib/redteam/engine";

type Ctx = { params: Promise<{ runId: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { runId } = await params;
  const res = await getRedTeam(runId);
  if (!res) return NextResponse.json({ error: "Red-team run not found" }, { status: 404 });
  return NextResponse.json(res);
});

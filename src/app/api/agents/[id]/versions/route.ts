import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { versionHistory } from "@/lib/redteam/history";

type Ctx = { params: Promise<{ id: string }> };

/** Every version of the agent, newest first, with its latest red-team score. */
export const GET = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  return NextResponse.json(await versionHistory(id));
});

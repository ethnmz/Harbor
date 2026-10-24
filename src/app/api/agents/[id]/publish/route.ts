import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { publishTemplate } from "@/lib/engine/agents";
import { getWorkspace } from "@/lib/seed";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const template = await publishTemplate(await getWorkspace(), id);
  return NextResponse.json({ template });
});

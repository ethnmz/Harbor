import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { getRunDetail } from "@/lib/queries";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const detail = await getRunDetail(id);
  if (!detail) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  return NextResponse.json(detail);
});

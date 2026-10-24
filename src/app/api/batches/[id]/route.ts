import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { getBatch } from "@/lib/queries";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  return NextResponse.json({ runs: await getBatch(id) });
});

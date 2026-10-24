import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { audit, HUMAN_ACTOR } from "@/lib/audit";
import { resetDemo } from "@/lib/seed";

export const POST = route(async () => {
  const ws = await resetDemo();
  await audit(HUMAN_ACTOR, "demo.reset", ws.id, {}, ws.id);
  return NextResponse.json({ ok: true });
});

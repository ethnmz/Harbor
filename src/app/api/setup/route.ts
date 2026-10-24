import { NextResponse } from "next/server";
import { audit, HUMAN_ACTOR } from "@/lib/audit";
import { runSetup } from "@/lib/setup";

export const maxDuration = 60;

/** One-click database setup from the browser (idempotent: migrations + seed only if empty). */
export async function POST() {
  const log: string[] = [];
  try {
    const ws = await runSetup((line) => log.push(line));
    await audit(HUMAN_ACTOR, "workspace.setup", ws.id, { log }, ws.id);
    return NextResponse.json({ ok: true, log });
  } catch (e) {
    console.error("Database setup failed:", e);
    return NextResponse.json({ ok: false, log, error: (e as Error).message }, { status: 500 });
  }
}

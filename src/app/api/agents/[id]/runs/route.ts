import { after, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { agents, tickets } from "@/lib/db/schema";
import { createRun, executeMany } from "@/lib/engine/run";

export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

/** Run on one ticket, or (for a live agent) on every open ticket in the inbox. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const body = z.object({ ticketId: z.string().optional(), inbox: z.boolean().optional() }).parse(await req.json());
  const [agent] = await db.select().from(agents).where(eq(agents.id, id));
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  let ticketIds: string[] = [];
  if (body.ticketId) ticketIds = [body.ticketId];
  else if (body.inbox) {
    const open = await db.select({ id: tickets.id }).from(tickets).where(and(eq(tickets.status, "open"), eq(tickets.inTestSet, false), eq(tickets.sandbox, false)));
    ticketIds = open.map((t) => t.id);
  }
  if (!ticketIds.length) return NextResponse.json({ error: "No tickets to run on" }, { status: 400 });

  const trigger = body.inbox && agent.status === "live" ? "live" : "manual";
  const runIds: string[] = [];
  for (const t of ticketIds) runIds.push((await createRun(id, t, trigger)).id);
  after(() => executeMany(runIds, 4));
  return NextResponse.json({ runIds });
});

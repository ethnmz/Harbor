import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { route } from "@/lib/api";
import { audit, HUMAN_ACTOR } from "@/lib/audit";
import { db } from "@/lib/db";
import { tickets } from "@/lib/db/schema";
import { getWorkspace } from "@/lib/seed";

type Ctx = { params: Promise<{ id: string }> };
const body = z.object({ status: z.enum(["resolved", "open"]) });

/** Resolve a ticket, or reopen it (back to triaged if an agent already triaged it). */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const { status } = body.parse(await req.json());
  const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id));
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  const next = status === "resolved" ? "resolved" : ticket.triageNote ? "triaged" : "open";
  const [updated] = await db.update(tickets).set({ status: next, updatedAt: new Date() }).where(eq(tickets.id, id)).returning();
  const ws = await getWorkspace();
  await audit(HUMAN_ACTOR, status === "resolved" ? "ticket.resolved" : "ticket.reopened", id, { status: next }, ws.id);
  return NextResponse.json({ ticket: updated });
});

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { route } from "@/lib/api";
import { audit, HUMAN_ACTOR } from "@/lib/audit";
import { db } from "@/lib/db";
import { outboundEmails, tickets } from "@/lib/db/schema";
import { getWorkspace } from "@/lib/seed";

type Ctx = { params: Promise<{ id: string }> };
const body = z.object({ body: z.string().trim().min(1).max(5000), resolve: z.boolean().optional() });

/** A person replies to the customer from the inbox. Recorded in the sandbox outbox like agent emails. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const input = body.parse(await req.json());
  const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id));
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  const ws = await getWorkspace();
  const [email] = await db
    .insert(outboundEmails)
    .values({ ticketId: id, toAddress: ticket.customerEmail, subject: `Re: ${ticket.subject}`, body: input.body })
    .returning();
  await db
    .update(tickets)
    .set({ updatedAt: new Date(), ...(input.resolve ? { status: "resolved" } : {}) })
    .where(eq(tickets.id, id));
  await audit(HUMAN_ACTOR, "ticket.replied", id, { to: ticket.customerEmail, resolved: Boolean(input.resolve) }, ws.id);
  return NextResponse.json({ email });
});

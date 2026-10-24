import { NextResponse } from "next/server";
import { z } from "zod";

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Uniform JSON errors for route handlers. */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid request", issues: e.issues }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: (e as Error).message ?? "Something went wrong" }, { status: 500 });
    }
  };
}

export const guardrailsSchema = z.object({
  maxSteps: z.number().int().min(1).max(50),
  maxCostUsd: z.number().min(0),
  maxRefundUsd: z.number().min(0),
  allowedSlackChannels: z.array(z.string()),
  rules: z.array(z.string()),
});

export const agentConfigSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500),
  instructions: z.string().min(1).max(8000),
  allowedTools: z.array(z.string()),
  riskyTools: z.array(z.string()),
  model: z.string(),
  guardrails: guardrailsSchema,
});

import { NextResponse } from "next/server";
import { checkAppUrl, checkDatabase, checkModel, checkSerpApi, checkSlack } from "@/lib/diagnostics";

export const maxDuration = 60;

/**
 * GET /api/health          -> database + Tiger checks and which keys are configured
 * GET /api/health?deep=1   -> also calls the model and SerpApi once (no Slack message)
 */
export async function GET(req: Request) {
  const deep = new URL(req.url).searchParams.has("deep");
  const checks = [
    ...(await checkDatabase()),
    ...(deep ? [await checkModel(), await checkSerpApi()] : []),
    await checkSlack(false),
    checkAppUrl(),
  ];
  const ok = !checks.some((c) => c.status === "fail");
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}

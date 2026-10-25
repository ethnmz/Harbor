import { NextResponse } from "next/server";
import { checkAppUrl, checkDatabase, checkModel, checkSerpApi, checkSlack } from "@/lib/diagnostics";

export const maxDuration = 60;

/**
 * GET /api/health          -> database + Tiger checks and which keys are configured
 * GET /api/health?deep=1   -> also calls the model and SerpApi once (no Slack message)
 * Both include `deployment`: which commit this deployment was built from (Vercel only).
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
  // Set by Vercel on Git deployments; a CLI deploy from someone's laptop leaves the commit fields empty.
  const deployment = {
    environment: process.env.VERCEL_ENV ?? "local",
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    message: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0] ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    productionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? null,
  };
  return NextResponse.json({ ok, deployment, checks }, { status: ok ? 200 : 503 });
}

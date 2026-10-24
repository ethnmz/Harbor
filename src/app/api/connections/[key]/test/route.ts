import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { audit, HUMAN_ACTOR } from "@/lib/audit";
import { checkModel, checkSerpApi, checkSlack, type Check } from "@/lib/diagnostics";
import { getWorkspace } from "@/lib/seed";

export const maxDuration = 60;

type Ctx = { params: Promise<{ key: string }> };

/** Live check for a workspace connection, used by the onboarding Test buttons. */
export const POST = route<Ctx>(async (req, { params }) => {
  const { key } = await params;
  const ws = await getWorkspace();
  const body = (await req.json().catch(() => ({}))) as { model?: string };
  let check: Check;
  if (key === "serpapi") check = await checkSerpApi();
  else if (key === "slack") check = await checkSlack(true);
  else if (key === "model") check = await checkModel(body.model ?? ws.defaultModel);
  else check = { name: key, status: "pass", detail: "Sandbox connection ready." };
  const result = {
    ok: check.status !== "fail",
    live: check.status === "pass",
    message: check.status === "pass" ? check.detail : `${check.detail}${check.fix ? `. ${check.fix}` : ""}`,
  };
  await audit(HUMAN_ACTOR, "connection.tested", key, result, ws.id);
  return NextResponse.json(result);
});

import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { audit, HUMAN_ACTOR } from "@/lib/audit";
import { getWorkspace } from "@/lib/seed";
import { serpSearch } from "@/lib/tools/serpapi";
import { postToSlack } from "@/lib/tools/slack";

type Ctx = { params: Promise<{ key: string }> };

/** Live check for a workspace connection, used during onboarding. */
export const POST = route<Ctx>(async (_req, { params }) => {
  const { key } = await params;
  const ws = await getWorkspace();
  let result: { ok: boolean; live: boolean; message: string };
  if (key === "serpapi") {
    try {
      const r = await serpSearch("google_news", "Cloudflare status");
      result = {
        ok: true,
        live: !r.simulated,
        message: r.simulated ? "No SERPAPI_API_KEY set: agents will get simulated results." : `Live: ${r.results.length} news results. Top: "${r.results[0]?.title ?? "n/a"}"`,
      };
    } catch (e) {
      result = { ok: false, live: false, message: (e as Error).message };
    }
  } else if (key === "slack") {
    const r = await postToSlack({ channel: "#support-urgent", text: ":white_check_mark: Harbor is connected. Agents will post urgent tickets and approval requests here.", context: "Connection test" });
    result = { ok: r.delivered || !process.env.SLACK_WEBHOOK_URL, live: r.delivered, message: r.delivered ? "Test message delivered to Slack." : (r.error ?? "Not delivered") };
  } else {
    result = { ok: true, live: true, message: "Sandbox connection ready." };
  }
  await audit(HUMAN_ACTOR, "connection.tested", key, result, ws.id);
  return NextResponse.json(result);
});

/**
 * Slack delivery through SLACK_WEBHOOK_URL. Without it, messages are stored and shown in Harbor only.
 * Works with an app's incoming webhook (hooks.slack.com/services/…) and with a Workflow Builder
 * webhook (hooks.slack.com/triggers/…), which only accepts flat string variables.
 */

export function appUrl() {
  if (process.env.HARBOR_APP_URL) return process.env.HARBOR_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export type SlackPost = {
  channel: string;
  text: string;
  context?: string;
  link?: { label: string; url: string };
};

export function slackWebhookUrl() {
  return process.env.SLACK_WEBHOOK_URL?.trim() || null;
}

/** Workflow Builder webhooks reject Block Kit; they take string variables defined in the workflow. */
export function isWorkflowWebhook(url: string) {
  try {
    return /\/(triggers|workflows)\//.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

function slackError(status: number, body: string, workflow: boolean) {
  const base = `Slack ${status}: ${body || "no details"}`;
  if (status === 400 && workflow) return `${base}. This URL is a Workflow Builder webhook: add a Text variable named "text" to the workflow and use it in the message step`;
  if (status === 403 || status === 404 || status === 410) return `${base}. The webhook was removed or the URL is incomplete`;
  return base;
}

export async function postToSlack(msg: SlackPost): Promise<{ delivered: boolean; error?: string }> {
  const url = slackWebhookUrl();
  if (!url) return { delivered: false, error: "SLACK_WEBHOOK_URL not set (message kept in Harbor)" };
  const workflow = isWorkflowWebhook(url);

  // Incoming webhooks post to the channel they were created for; we label the intended channel.
  const blocks: unknown[] = [
    { type: "section", text: { type: "mrkdwn", text: msg.text } },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: `${msg.channel} · ${msg.context ?? "Sent by a Harbor agent"}` }],
    },
  ];
  if (msg.link)
    blocks.push({
      type: "actions",
      elements: [{ type: "button", text: { type: "plain_text", text: msg.link.label }, url: msg.link.url }],
    });

  const text = `[${msg.channel}] ${msg.text}${msg.link ? `\n<${msg.link.url}|${msg.link.label}>` : ""}`;
  const attempts = workflow
    ? // Map these onto Workflow Builder variables; every value must be a string.
      [{ text, channel: msg.channel, context: msg.context ?? "Sent by a Harbor agent", link: msg.link?.url ?? "" }]
    : // Rich message first; if Slack rejects the blocks, plain text still gets through.
      [{ text, blocks }, { text }];

  let error = "";
  try {
    for (const body of attempts) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) return { delivered: true };
      error = slackError(res.status, (await res.text()).trim(), workflow);
      if (res.status !== 400) break; // only a payload problem is worth retrying
    }
  } catch (e) {
    error = (e as Error).message;
  }
  return { delivered: false, error };
}

/** Slack incoming webhook. Without SLACK_WEBHOOK_URL messages are stored and shown in Harbor only. */

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

export async function postToSlack(msg: SlackPost): Promise<{ delivered: boolean; error?: string }> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return { delivered: false, error: "SLACK_WEBHOOK_URL not set (message kept in Harbor)" };

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

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `[${msg.channel}] ${msg.text}`, blocks }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return { delivered: false, error: `Slack ${res.status}: ${await res.text()}` };
    return { delivered: true };
  } catch (e) {
    return { delivered: false, error: (e as Error).message };
  }
}

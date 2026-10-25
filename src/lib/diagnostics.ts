/**
 * Pre-demo checks shared by `npm run doctor`, GET /api/health and the onboarding Test buttons.
 * Missing optional keys are warnings (Harbor falls back to a labelled simulator), not failures.
 */
import Anthropic from "@anthropic-ai/sdk";
import { anthropicProvider } from "./llm/anthropic";
import { DEFAULT_MODEL } from "./llm/models";
import { serpSearch } from "./tools/serpapi";
import { appUrl, isWorkflowWebhook, postToSlack, slackWebhookUrl } from "./tools/slack";

export type CheckStatus = "pass" | "warn" | "fail";
export type Check = { name: string; status: CheckStatus; detail: string; fix?: string };

const secs = (t0: number) => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

export async function checkDatabase(): Promise<Check[]> {
  if (!process.env.DATABASE_URL)
    return [{ name: "Database", status: "fail", detail: "DATABASE_URL is not set", fix: "Paste your Tiger Cloud connection string into DATABASE_URL (with ?sslmode=require)." }];
  const out: Check[] = [];
  try {
    const { sql } = await import("./db");
    const t0 = Date.now();
    const [{ version }] = await sql<{ version: string }[]>`select version()`;
    const host = new URL(process.env.DATABASE_URL).hostname;
    out.push({ name: "Database", status: "pass", detail: `Connected to ${host} in ${secs(t0)} (${version.split(" on ")[0]})` });

    const [ext] = await sql<{ extversion: string }[]>`select extversion from pg_extension where extname = 'timescaledb'`;
    if (!ext) {
      out.push({ name: "TimescaleDB", status: "warn", detail: "Extension not installed: audit_log is a plain table", fix: "Use a Tiger Cloud service, then re-run npm run db:setup." });
    } else {
      const [{ n }] = await sql<{ n: number }[]>`
        select count(*)::int as n from timescaledb_information.hypertables where hypertable_name = 'audit_log'`;
      out.push(
        n
          ? { name: "TimescaleDB", status: "pass", detail: `v${ext.extversion}; audit_log is a hypertable with compression + retention` }
          : { name: "TimescaleDB", status: "warn", detail: `v${ext.extversion} installed but audit_log is not a hypertable yet`, fix: "Run npm run db:setup." },
      );
    }

    const [{ ready }] = await sql<{ ready: boolean }[]>`select to_regclass('public.tickets') is not null as ready`;
    if (!ready) {
      out.push({ name: "Schema + seed", status: "fail", detail: "Tables are missing", fix: "Run npm run db:setup against this DATABASE_URL." });
    } else {
      const [c] = await sql<{ tickets: number; workspaces: number; agents: number }[]>`
        select (select count(*) from tickets)::int as tickets,
               (select count(*) from workspaces)::int as workspaces,
               (select count(*) from agents)::int as agents`;
      out.push(
        c.tickets >= 15 && c.workspaces === 1
          ? { name: "Schema + seed", status: "pass", detail: `${c.tickets} tickets, ${c.agents} agents` }
          : { name: "Schema + seed", status: "warn", detail: `${c.tickets} tickets, ${c.workspaces} workspaces`, fix: "Run npm run db:reset for a clean demo." },
      );
    }
  } catch (e) {
    out.push({ name: "Database", status: "fail", detail: (e as Error).message, fix: "Check the connection string, password and ?sslmode=require." });
  }
  return out;
}

export async function checkModel(model = DEFAULT_MODEL): Promise<Check> {
  if (process.env.LLM_PROVIDER === "simulated")
    return { name: "Model", status: "warn", detail: "LLM_PROVIDER=simulated: runs use the Harbor simulator", fix: "Unset LLM_PROVIDER to use the live model." };
  if (!process.env.ANTHROPIC_API_KEY)
    return { name: "Model", status: "warn", detail: "ANTHROPIC_API_KEY not set: runs use the Harbor simulator", fix: "Set ANTHROPIC_API_KEY." };
  const t0 = Date.now();
  try {
    const res = await anthropicProvider.chat({
      model,
      system: "You are a connectivity check. Reply with the single word OK.",
      messages: [{ role: "user", content: [{ type: "text", text: "ping" }] }],
      tools: [],
      effort: "low",
      maxTokens: 1024,
    });
    return { name: "Model", status: "pass", detail: `${res.model} answered in ${secs(t0)}` };
  } catch (e) {
    const fix =
      e instanceof Anthropic.AuthenticationError
        ? "ANTHROPIC_API_KEY was rejected. Create a new key in the Claude Console."
        : e instanceof Anthropic.NotFoundError
          ? `Model ${model} is not available to this key. Pick another model in Workspace settings.`
          : e instanceof Anthropic.RateLimitError
            ? "Rate limited. Wait a minute, or lower test-run concurrency."
            : "Check network access to api.anthropic.com.";
    return { name: "Model", status: "fail", detail: (e as Error).message, fix };
  }
}

export async function checkSerpApi(): Promise<Check> {
  if (!process.env.SERPAPI_API_KEY)
    return { name: "SerpApi", status: "warn", detail: "SERPAPI_API_KEY not set: search results are simulated", fix: "Set SERPAPI_API_KEY (serpapi.com → Your account → API key)." };
  const t0 = Date.now();
  try {
    const r = await serpSearch("google_news", "Cloudflare status");
    return { name: "SerpApi", status: "pass", detail: `${r.results.length} live Google News results in ${secs(t0)}. Top: "${r.results[0]?.title ?? "n/a"}"` };
  } catch (e) {
    return { name: "SerpApi", status: "fail", detail: (e as Error).message, fix: "Check the key and remaining searches on serpapi.com." };
  }
}

const SLACK_SETUP =
  "Simplest fix: api.slack.com/apps → your app → Incoming Webhooks → Add New Webhook → pick #support-urgent, put that URL (https://hooks.slack.com/services/…) in SLACK_WEBHOOK_URL, then redeploy.";

export async function checkSlack(send: boolean): Promise<Check> {
  const url = slackWebhookUrl();
  if (!url) return { name: "Slack", status: "warn", detail: "SLACK_WEBHOOK_URL not set: messages stay in Harbor", fix: SLACK_SETUP.replace("Simplest fix: ", "") };
  const kind = isWorkflowWebhook(url) ? "Workflow Builder webhook" : "Incoming webhook";
  if (!send) return { name: "Slack", status: "pass", detail: `${kind} configured (not tested; pass --slack to send a test message)` };
  const r = await postToSlack({ channel: "#support-urgent", text: ":white_check_mark: Harbor is connected. Urgent tickets and approval requests will appear here.", context: "Connection test" });
  return r.delivered ? { name: "Slack", status: "pass", detail: `Test message delivered (${kind.toLowerCase()})` } : { name: "Slack", status: "fail", detail: r.error ?? "Not delivered", fix: SLACK_SETUP };
}

export function checkAppUrl(): Check {
  const url = appUrl();
  return url.includes("localhost") && process.env.NODE_ENV === "production"
    ? { name: "App URL", status: "warn", detail: `Slack links point at ${url}`, fix: "Set HARBOR_APP_URL to your public URL." }
    : { name: "App URL", status: "pass", detail: `Slack links point at ${url}` };
}

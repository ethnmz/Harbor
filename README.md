# Harbor ⚓

**Build agents your company will actually let run.**

Harbor lets a non-technical team lead describe an agent in plain English and get a working, enterprise-safe agent in about a minute. It handles the setup every agent repeats (connecting tools, configuring a model, writing instructions, adding guardrails and monitoring) once, at the workspace level. Each new agent reuses it.

> Built at HackTX 2026 for **"Build the Platform Behind the Agent"** (Northmark Compute and Cloud), plus **Best Use of SerpApi** and **Best Use of Tiger Data**.

Meet Maya, a support lead at Tidewell (a mid-size scheduling SaaS). She types:

> *Sort incoming support tickets by urgency, look up outage news if a ticket mentions an outage, and post urgent ones to #support-urgent.*

Harbor generates the agent, tests it on 10 real-looking tickets, and deploys it. Every step lands in Postgres. When she clones it into a **Refund Agent**, the refund pauses until a manager approves it.

---

## What it does

| Step | What happens |
|---|---|
| **1. Workspace setup** (once) | A Duolingo-style flow, one question per screen, guided by three 3D glass mascots (Orbit, Facet, Murmur): company profile, tools (support inbox, SerpApi web + news search, Slack, billing, email), default model, approvals, guardrails, Slack channels and house rules. `/onboarding` |
| **2. Describe** | Type the job in plain English. `/agents/new` |
| **3. Generate** | The LLM turns it into a config: name, step-by-step instructions, allowed tools, tools needing approval, model, guardrails. Company policy is then **enforced in code** (e.g. `email_customer` always needs approval) and shown as an editable card. |
| **4. Test run** | Runs the agent on 10 seeded tickets in parallel and shows a live report: handled / flagged / needs approval / failed, with reasons. |
| **5. Deploy** | Agent goes live and can work the inbox. Every run, step, tool call, input, output, latency, token count, cost estimate and approval is logged. |
| **6. Reuse** | Save as a template, or clone into a new agent ("Refund Agent") with a one-line change request. The LLM adapts the config and keeps the workspace setup. |

### The enterprise layer (the differentiator)

- **Least-privilege permissions.** The model only sees the tools its config allows; anything else is blocked and logged. Tools are scoped to the ticket being worked, so an agent can't touch other tickets or email arbitrary addresses.
- **Approvals.** Risky tools (`issue_refund`, `email_customer`) pause the run, create a pending approval, and notify Slack. A manager approves or rejects in `/approvals` (or inline in the run timeline), and the run resumes from exactly where it stopped.
- **Guardrails enforced in code, not just the prompt.** Refund limit, approved Slack channels, max steps, and a per-run cost budget. Generated configs can be stricter than workspace policy, never looser.
- **Prompt-injection posture.** Ticket text is treated as data; policies override instructions found in tickets.
- **Activity log.** Append-only `audit_log` of every human and agent action. On Tiger Cloud it is a TimescaleDB hypertable with compression and a 400-day retention policy.
- **Monitoring.** `/dashboard` shows runs, success rate, items routed to humans, pending approvals, estimated spend, SerpApi usage, outcomes over time, per-agent stats, and what was posted to Slack.

---

## Architecture

```mermaid
flowchart LR
  subgraph UI["Next.js UI (App Router)"]
    O["/onboarding<br/>workspace setup"]
    N["/agents/new<br/>describe → config → test → deploy"]
    R["/runs/[id]<br/>step timeline"]
    A["/approvals"]
    D["/dashboard"]
  end

  subgraph Engine["Agent engine (route handlers)"]
    G["Config generator<br/>LLM + structured output<br/>+ policy enforcement"]
    L["Run loop<br/>tool calls · guardrails ·<br/>approval pause/resume"]
    M["LLM module<br/>(one swappable provider)"]
  end

  subgraph Tools["Tools (workspace connections)"]
    S["SerpApi<br/>Google News + Google"]
    K["Slack<br/>incoming webhook"]
    T["Ticket inbox<br/>(sandbox)"]
    B["Refunds + email<br/>(sandbox, write to DB)"]
  end

  DB[("Tiger Cloud Postgres<br/>workspaces · tools · templates · agents<br/>tickets · runs · run_steps · approvals<br/>audit_log (hypertable)")]

  UI --> Engine
  G --> M
  L --> M
  L --> Tools
  Engine --> DB
  Tools --> DB
  D -->|time_bucket| DB
```

- **UI → engine.** Pages are server components that read Postgres directly; interactive parts (builder, timeline, approvals) are client components that call route handlers and poll for progress.
- **Run loop** (`src/lib/engine/run.ts`). A manual tool-use loop rather than an SDK runner, because a run has to **pause** on a risky action, persist its conversation to Postgres (`runs.state` jsonb), and **resume** in a different request after a manager decides. Assistant turns are stored verbatim so they replay exactly.
- **LLM module** (`src/lib/llm/`). Every model call goes through `getProvider()`. The Anthropic adapter is the default; add an adapter implementing `LlmProvider` to swap providers. Without a key, a built-in **simulator** plays the agent so the whole pipeline still runs offline. It is clearly labelled "Simulated" in the UI.
- **Background work.** Test runs and approval resumes use Next's `after()` to keep working after the response is sent; the UI polls `/api/batches/[id]` and `/api/runs/[id]`. If background work ever stalls, the client re-kicks queued runs (`/api/runs/[id]/execute` is idempotent).

### How we use SerpApi

SerpApi is how the agent checks the world outside the ticket. When a ticket says *"people on X are talking about a Cloudflare outage"*, the agent calls `news_search` (SerpApi **`google_news`** engine, with a `when:1d` recency filter) before deciding urgency. It cites the top story in the internal note and in the Slack alert. `web_search` (SerpApi **`google`** engine) finds status pages and docs. Results are rendered as cards in the run timeline (Live / Cached / Simulated), each search is cost-accounted in the run's estimate, and onboarding has a live **Test** button for the connection. Code: `src/lib/tools/serpapi.ts`.

### How we use Tiger Data

Tiger Cloud Postgres is Harbor's system of record. That makes it the platform's observability and compliance layer, not just a store:

- **Every run and step** (`runs`, `run_steps`) with inputs, outputs, latency, tokens and cost. The run timeline is a direct view of these rows; click `{ }` on any step to see the raw row.
- **Pause/resume state** for approvals (`runs.state` jsonb, `approvals`), so a run can stop on a refund and continue minutes later in a different serverless invocation.
- **`audit_log` as a TimescaleDB hypertable** (`create_hypertable`), with **compression after 30 days** and a **400-day retention policy**, set up automatically by `npm run db:setup` when the extension is available.
- **Dashboard time series** bucketed with **`time_bucket()`** (falls back to `date_bin` on plain Postgres).

Code: `src/lib/db/schema.ts`, `src/lib/seed.ts` (`setupTimescale`), `src/lib/queries.ts` (`runTimeline`).

---

## Data model

`workspaces` (default model, policies) · `tools` (workspace connections + non-secret config) · `templates` (instructions, allowed_tools, risky_tools, model, guardrails) · `agents` (template_id, status) · `tickets` (15 seeded: 2 outage reports, 3 refund requests; 10 form the test set) · `runs` (agent, ticket, batch, trigger, status, outcome, tokens, cost, state) · `run_steps` (type, tool, input/output jsonb, latency, tokens, cost) · `approvals` (run, step, action, args, status, decided_by/at) · `audit_log` (actor, action, target, details) · plus sandbox side-effect tables `refunds`, `outbound_emails`, `slack_messages`.

---

## Run it locally

Requirements: Node 20+, a Postgres database (a [Tiger Cloud](https://www.tigerdata.com/) service, or local Postgres 14+).

```bash
npm install
cp .env.example .env.local        # set DATABASE_URL at minimum
npm run db:setup                  # migrations + Tiger/TimescaleDB extras + seed data
npm run dev                       # http://localhost:3000
```

| Variable | Required | What it does |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string (Tiger Cloud: use the service URL with `?sslmode=require`). |
| `ANTHROPIC_API_KEY` | for live model | Without it, runs use the labelled simulator. |
| `SERPAPI_API_KEY` | for live search | Without it, search results are simulated (and say so). |
| `SLACK_WEBHOOK_URL` | for live Slack | Without it, messages are stored and shown in Harbor only. |
| `HARBOR_APP_URL` | optional | Public URL used in Slack links (defaults to the Vercel URL). |
| `LLM_PROVIDER` | optional | `anthropic` or `simulated` to force a provider. |
| `HARBOR_DEFAULT_MODEL` | optional | Default model for a new workspace. |
| `HARBOR_SIMULATOR_FALLBACK` | optional | `0` makes runs fail instead of finishing on the simulator when the live model is unreachable. |

### Scripts

| Command | |
|---|---|
| `npm run db:setup` | Apply migrations, enable TimescaleDB extras on Tiger Cloud, seed the demo workspace (idempotent). |
| `npm run db:reset` | Same, then wipe agents/runs/approvals/logs and re-seed the inbox. Same as the **Reset demo** button. |
| `npm run doctor` | Pre-demo check of every connection: database, TimescaleDB hypertable, seed data, model key, SerpApi, Slack (`-- --slack` sends a test message). Deployed apps expose the same checks at `/api/health` (`?deep=1` also calls the model and SerpApi). |
| `npm run smoke` | Engine end-to-end check against `DATABASE_URL`: generate → run an outage ticket → clone to a refund agent → pause for approval → approve → resume. |
| `npm run e2e -- <url>` | Full HTTP test of a running app, local or deployed: every page, connection tests, config generation and policy, a 10-ticket test run, deploy, clone, approve, double and concurrent approvals, the $150 guardrail, reject, and the live inbox. It resets demo data before and after (`--keep` skips the final reset); `--no-slack` skips the Slack test message. |
| `npm run db:generate` | Generate a new migration after editing `src/lib/db/schema.ts`. |
| `npm run typecheck` / `npm run lint` / `npm run build` | The usual. |

## Deploy (Vercel + Tiger Cloud), about 15 minutes

1. **Tiger Cloud.** Create a service at [console.cloud.timescale.com](https://console.cloud.timescale.com) (the free tier is fine). Copy its connection string: `postgres://tsdbadmin:<password>@<id>.<project>.tsdb.cloud.timescale.com:<port>/tsdb?sslmode=require`.
2. **Keys.** Anthropic API key ([console.anthropic.com](https://console.anthropic.com)); SerpApi key ([serpapi.com/manage-api-key](https://serpapi.com/manage-api-key)); Slack incoming webhook ([api.slack.com/apps](https://api.slack.com/apps) → Create app → Incoming Webhooks → add to `#support-urgent`).
3. **Set up the database from your laptop.** Put the four values in `.env.local`, then:
   ```bash
   npm install
   npm run db:setup          # tables, audit_log hypertable + policies, seed data
   npm run doctor -- --slack # every line should be ✅
   npm run dev               # optional: rehearse locally against Tiger
   ```
4. **Vercel.** [vercel.com/new](https://vercel.com/new) → import `ethnmz/Harbor` (branch `claude/gracious-turing-4a25i9`, or merge it to `main` first) → add `DATABASE_URL`, `ANTHROPIC_API_KEY`, `SERPAPI_API_KEY`, `SLACK_WEBHOOK_URL` under Environment Variables → Deploy. After the first deploy, add `HARBOR_APP_URL=https://<your-app>.vercel.app` so Slack buttons link back correctly, then redeploy.
5. **Verify.** Open `https://<your-app>.vercel.app/api/health?deep=1`. `"ok": true` with Database, TimescaleDB, Model and SerpApi all `pass` means you're live. Then rehearse `docs/DEMO.md` once and press **Reset demo**.

Long-running routes declare `maxDuration = 300`, which needs Vercel Fluid compute (the default for new projects). If your plan caps lower, reduce it in `src/app/api/**/route.ts`. A 10-ticket test run takes roughly 15–40 s on a live model.

## Demo

See [`docs/DEMO.md`](docs/DEMO.md) for the 90-second script. **Reset demo** (sidebar) returns to a clean state at any time and keeps the workspace setup.

## Project layout

```
src/app/                 pages + route handlers (api/)
src/components/          UI: agent builder, run timeline, approvals board, charts, primitives
src/lib/db/              Drizzle schema + client
src/lib/llm/             provider interface, Anthropic adapter, offline simulator, model catalog
src/lib/tools/           tool registry, SerpApi, Slack
src/lib/engine/          config generation, policy enforcement, prompts, run loop + approvals
src/lib/seed*.ts         demo workspace, 15 tickets, starter templates, Tiger setup
scripts/                 db setup/reset, smoke test, doctor, e2e suite
drizzle/                 SQL migrations
docs/                    demo script, Devpost draft
```

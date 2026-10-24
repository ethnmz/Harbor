# Harbor: build agents your company will actually let run

Maya leads customer support at a mid-size company. She can see exactly which work an AI agent should take off her team's plate, but every agent she's tried means weeks of setup (wiring tools, picking a model, writing prompts, bolting on logging). Even then, nobody will let it touch a refund on Monday.

## Inspiration

Building an agent today means repeating the same plumbing every time: connect the tools, configure the model, write the instructions, add monitoring. The hard part for real companies isn't the plumbing, though. It's trust. Support leads like Maya don't need another framework. They need an agent they can describe in a sentence, test before it goes live, and stop or approve before it does something expensive. We wanted to build the platform layer that makes that the default.

## What it does

Harbor turns a plain-English job description into a working, enterprise-safe agent in about a minute.

1. **Workspace setup, once.** Connect the support inbox, **SerpApi** web and news search, Slack, billing and email. Pick a default model. Set company policies: which actions always need approval, the refund limit, approved Slack channels, step and cost budgets, house rules.
2. **Describe.** Maya types: *"Sort incoming support tickets by urgency, look up outage news if a ticket mentions an outage, and post urgent ones to #support-urgent."*
3. **Generate.** An LLM designs the agent (name, step-by-step instructions, the fewest tools that do the job, which actions need approval, guardrails) and Harbor enforces company policy on top, in code. The config appears as an editable card.
4. **Test.** The agent works 10 sample tickets in parallel and Harbor shows a live report: handled, flagged, waiting for approval, or failed, each with a reason. The two tickets that mention an outage trigger a SerpApi Google News check, and the evidence is cited in the ticket note and the Slack alert.
5. **Deploy.** One click and the agent is live. Every run, step, tool call, input, output, latency, token count, cost estimate and approval is logged in **Tiger Data** Postgres and viewable as a timeline.
6. **Reuse.** Save it as a template, or clone it into a *Refund Agent* with one sentence. When the refund agent wants to refund $49 and email the customer, the run **pauses**, Slack is notified, and Maya approves in Harbor. The run then resumes exactly where it stopped. A $228 refund over the policy limit is blocked by a guardrail and routed to a human.

A monitoring dashboard shows runs, success rate, what was routed to humans, pending approvals, estimated spend, SerpApi usage, and the full audit log.

## How we built it

- **Next.js (App Router) + TypeScript + Tailwind**, with hand-built shadcn-style components, deployed on **Vercel**.
- **Agent engine.** A manual tool-use loop, rather than an SDK runner, because a run has to pause on a risky action, persist its conversation, and resume in a different serverless request after a human decides. Next's `after()` runs test batches and resumes in the background while the UI polls Postgres for live progress.
- **LLM.** Anthropic Claude through a single provider interface (`src/lib/llm`), so the model is swappable per workspace and per agent. Config generation uses structured JSON output; tools use strict schemas; server-side refusal fallbacks are on. A clearly labelled offline simulator keeps the whole pipeline demoable without network access.
- **SerpApi.** `news_search` uses the `google_news` engine with a `when:1d` recency filter so agents verify "is X down?" claims against live reporting before escalating. `web_search` uses the `google` engine for status pages and docs. Results render as cards in the run timeline, each search is cost-accounted, and onboarding has a live connection test.
- **Tiger Data.** Tiger Cloud Postgres is the system of record: workspaces, templates, agents, tickets, runs, `run_steps`, approvals and the pause/resume state (jsonb). The append-only `audit_log` is a **TimescaleDB hypertable** with compression and a 400-day retention policy, and the dashboard's outcome chart is bucketed with `time_bucket()`. Drizzle ORM handles schema and migrations.
- **Slack.** An incoming webhook for urgent-ticket alerts and approval requests, with a link back to Harbor.

## Challenges we ran into

- **Pausing an agent mid-thought.** Approvals mean stopping between a model's tool request and its execution, surviving a serverless boundary, then resuming. We persist the exact assistant turn, execute only the approved calls, return rejections as tool errors the agent can reason about, and use an atomic "claim the run only if nothing is still pending" update so two managers approving at once can't double-run it.
- **Policy that can't be prompted away.** Putting "never refund over $150" in a prompt isn't a control. We moved every policy into code (tool allowlists, ticket-scoped tools, channel allowlists, refund limits, step and cost budgets), so the prompt only explains rules that are already enforced.
- **A demo that can't fail.** Live LLM, search and Slack calls at a judging table are a risk. Each connection degrades to a clearly labelled simulated mode, and a one-click reset returns to a clean seeded state.

## Accomplishments that we're proud of

- Describe → tested → deployed agent in about a minute, with a real 10-ticket test report before anything goes live.
- Approvals that actually pause and resume a running agent, end to end.
- A step-level timeline where every row is real data in Tiger Postgres, including the raw row behind each step.
- Generated configs are least-privilege by default, and company policy visibly corrects them ("email_customer always needs manager approval").

## What we learned

- Enterprises don't block agents because of model quality. They block them because of missing controls: permissions, approvals, audit trails, budgets.
- Treating the database as the agent's memory *and* its audit log makes pause/resume, monitoring and compliance the same problem.
- Live search grounding changes triage quality: "is Cloudflare down?" is a question an agent should answer with evidence, not a guess.

## What's next for Harbor

- Approve or reject directly from Slack with interactive buttons and SSO-backed identities.
- Real connectors: Zendesk, Intercom, Stripe refunds, Gmail.
- Role-based approvers and per-team policy packs.
- Evaluation sets: re-run the 10-ticket test automatically whenever a config changes, and block deploys that regress.
- Continuous aggregates on Tiger for per-agent SLOs and cost alerts.

## Built with

Next.js · TypeScript · Tailwind CSS · Drizzle ORM · Tiger Cloud (Postgres + TimescaleDB) · SerpApi · Anthropic Claude · Slack · Vercel

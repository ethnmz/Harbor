# Harbor demo script (60–90 s)

**Before judges arrive:** click **Reset demo** in the sidebar. Keep two tabs open: Harbor on `/agents/new`, and Slack on `#support-urgent` if `SLACK_WEBHOOK_URL` is set. Check that the Home **Go live** card says **Harbor in full throttle!** (otherwise it lists what's simulated). If the venue wifi dies, everything still runs on the labelled simulator.

| Time | Say | Do |
|---|---|---|
| **0:00–0:10** Problem | "This is Maya. She runs support at a mid-size company. Every team can spin up an AI agent now, but none of them are ones her company will let run on Monday: no permissions, no approvals, no audit trail. And every new agent repeats the same setup." | Click the gear at the bottom of the rail: the workspace summary with the three mascots. "Harbor does that setup once, for the whole workspace." (Optional, +20 s: **Replay setup** and click through two screens: Facet on tools, then the guardrail sliders. One question per screen, like Duolingo.) |
| **0:10–0:25** Describe → generate | "Maya just types the job." | From Home, type it into **Build an agent** and press the arrow (or **New agent** → **Ticket triage** chip → **Create my agent**). One question per screen, like onboarding: **Meet** the agent → **Looks good** → **What can it use?** (point at *Ask first* locked by policy: least privilege) → **Continue** → **Set its limits**. |
| **0:25–0:40** Test on 10 tickets | "Before anything goes live, it runs on ten real-looking tickets." | **Save & test on 10 tickets**. Tickets flip to Urgent / High / Low live. Point at the globe icon: "these two mention an outage, so it checked the news with SerpApi." |
| **0:40–0:50** Timeline + Tiger log | "Every step is a row in Tiger Postgres." | Click **Timeline** on TCK-1001 (opens in a new tab): the SerpApi news cards, the Slack alert with the evidence link, the `{ }` raw row. Back in the builder tab: **Continue** → **Go live**: the agent is live. |
| **0:50–1:10** Clone → approval | "Now a refund agent. Same workspace, one sentence." | **Open agent** → **More** → **Clone** → *Refund Agent* (prefilled) → **Clone agent** → **Looks good** → **Continue** → **Save & test on 10 tickets**. "Refunds are risky, so it **paused**: $49 refund plus a customer email, waiting for a manager. The $228 one is over our limit, so the guardrail sent it to a human." → **Review approvals** (on the test screen) → **Approve all** → **Watch it finish**. (Shortcut: the paused refund also appears in the Home **Activity** card, where **Approve all 2** resumes it in one click.) |
| **1:10–1:20** Monitor + close | "Everything is monitored: success rate, what went to humans, cost, every approval." | `/dashboard`. **"Harbor: build agents your company will actually let run."** |

## Red-team + Self-healing (60 s)

Before you start, open **Agents → Support Triage + Refunds** and click **Reset demo to v1**.

| Say | Do |
|---|---|
| "Before an agent goes live, Harbor attacks it." | **Red-team this agent**. Eight attacks run in a sandbox, so refunds, emails and Slack posts are intercepted. The grid fills in, about 5–20 s. |
| "Three got through: a $450 refund with no invoice, a 'CEO' asking for $900, and account details emailed to an outside accountant." | Click a red tile: you see the reason, the attack and **Open the run timeline**, where the intercepted step is. |
| "Harbor proposes the fix: refund cap and approvals enforced in code, outside emails blocked, instructions hardened." | **Fix with Harbor**. Walk through the diff: red is old, green is new. |
| "Accept writes v2, an immutable version, and re-verifies it automatically." | **Accept & re-verify**. The tiles flip to green, 8/8, and the test tickets stay 10/10. The badge goes v1 → v2. |
| "Every step is in the audit log." | `/activity`. |

## Backup lines for questions

- **"Is the policy just in the prompt?"** No. `src/lib/engine/config.ts` (`enforcePolicy`) and the run loop's guardrails block disallowed tools, unapproved Slack channels, over-limit refunds, and step/cost overruns *in code*, and log the block.
- **"How does it resume after approval?"** The conversation is persisted in `runs.state` (jsonb). The approval endpoint atomically claims the run only when no approvals remain pending, executes approved actions, and continues the loop.
- **"What does SerpApi add?"** Agents verify outage claims against live Google News before escalating, and cite the source in the ticket note and Slack alert.
- **"What does Tiger add?"** All state, the step-level observability log, the approvals, and an `audit_log` hypertable with compression and 400-day retention. Dashboard buckets use `time_bucket()`.
- **"Can I swap the model?"** Per workspace and per agent. The provider sits behind one interface in `src/lib/llm/`.

# Harbor demo script (60–90 s)

**Before judges arrive:** click **Reset demo** in the sidebar. Keep two tabs open: Harbor on `/agents/new`, and Slack on `#support-urgent` if `SLACK_WEBHOOK_URL` is set. Check that the sidebar's *Connections* box shows Model / SerpApi / Slack as **Live**. If the venue wifi dies, everything still runs on the labelled simulator.

| Time | Say | Do |
|---|---|---|
| **0:00–0:10** Problem | "This is Maya. She runs support at a mid-size company. Every team can spin up an AI agent now, but none of them are ones her company will let run on Monday: no permissions, no approvals, no audit trail. And every new agent repeats the same setup." | Point at the sidebar: connections, policies, approvals. "Harbor does that setup once, for the whole workspace." |
| **0:10–0:25** Describe → generate | "Maya just types the job." | From Home, type it into **Describe a new agent…** in the right rail and press Enter (or `/agents/new` → **Ticket triage** chip → **Generate agent**). Point at the card: tools chosen, *least privilege*, guardrails, the policy callout. |
| **0:25–0:40** Test on 10 tickets | "Before anything goes live, it runs on ten real-looking tickets." | **Save & test on 10 tickets**. Tickets flip to Urgent / High / Low live. Point at the globe icon: "these two mention an outage, so it checked the news with SerpApi." |
| **0:40–0:50** Timeline + Tiger log | "Every step is a row in Tiger Postgres." | Click **Timeline** on TCK-1001: the SerpApi news cards, the Slack alert with the evidence link, the `{ }` raw row. Then **Deploy agent**: the agent is live. |
| **0:50–1:10** Clone → approval | "Now a refund agent. Same workspace, one sentence." | **Open agent** → **Clone** → *Refund Agent* (prefilled) → **Clone agent** → **Save & test**. "Refunds are risky, so it **paused**: $49 refund plus a customer email, waiting for a manager. The $228 one is over our limit, so the guardrail sent it to a human." → **Review approvals** → **Approve all** → **Watch it finish**. (Shortcut: the paused refund also appears in the Home **Activity** rail, where **Approve all 2** resumes it in one click.) |
| **1:10–1:20** Monitor + close | "Everything is monitored: success rate, what went to humans, cost, every approval." | `/dashboard`. **"Harbor: build agents your company will actually let run."** |

## Backup lines for questions

- **"Is the policy just in the prompt?"** No. `src/lib/engine/config.ts` (`enforcePolicy`) and the run loop's guardrails block disallowed tools, unapproved Slack channels, over-limit refunds, and step/cost overruns *in code*, and log the block.
- **"How does it resume after approval?"** The conversation is persisted in `runs.state` (jsonb). The approval endpoint atomically claims the run only when no approvals remain pending, executes approved actions, and continues the loop.
- **"What does SerpApi add?"** Agents verify outage claims against live Google News before escalating, and cite the source in the ticket note and Slack alert.
- **"What does Tiger add?"** All state, the step-level observability log, the approvals, and an `audit_log` hypertable with compression and 400-day retention. Dashboard buckets use `time_bucket()`.
- **"Can I swap the model?"** Per workspace and per agent. The provider sits behind one interface in `src/lib/llm/`.

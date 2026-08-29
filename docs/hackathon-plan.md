# Reply: one-day hackathon plan

> Planning document only. The starter repository deliberately has an empty product schema and no Reply feature implementation.

## Product thesis

Small service businesses do not need another email client. They need a shared work queue that happens to contain email.

Reply turns sales, accounts, and support inboxes into owned conversations. Every thread has a status, an assignee, useful company context, and a safe path from an incoming request to a polished response.

## The judging demo

Use one continuous story instead of touring screens:

1. A message from Northstar arrives in Sales and is marked urgent.
2. The operator opens it and sees the conversation, current owner, priority, and shared labels.
3. Context.dev turns `northstar.ae` into a concise company card without leaving the inbox.
4. Reply Copilot combines that context with the thread and generates a warm, commercially useful draft through Convex AI Gateway.
5. The operator edits the text, demonstrating that AI assists rather than acts autonomously.
6. The reply is sent and the thread moves to Waiting, where the rest of the team can see its state.

This is a two-minute loop with a visible before-and-after. Keep the browser on this path during the pitch.

## One-day scope

### Must ship

- Responsive shared-inbox interface with Sales, Accounts, and Support
- Realistic dummy customers, messages, teammates, labels, and statuses
- Passkey sign-in and per-workspace authorization
- Idempotent creation of a private demo workspace
- Assignment, reply, waiting, closed, and unread concepts
- Company enrichment by sender domain through Context.dev
- Context-aware draft generation through Convex AI Gateway
- Clear preview behavior when live services are not configured
- A repeatable demo script and a clean build

### Good if time remains

- Activity events such as “Maya assigned this to Noah”
- Internal mentions and notes that are never sent to the customer
- AI triage suggestion: inbox, urgency, owner, and labels
- Optimistic UI for assignment and status updates
- Streaming draft text from the Convex Agent component
- Keyboard shortcuts for next conversation, close, and compose

### Explicitly not in the hackathon build

- Gmail or Microsoft OAuth
- Historical mailbox import
- IMAP, SMTP, or outbound email delivery
- Webhook ingestion and delivery retries
- Production billing, audit export, or enterprise administration
- Autonomous sending or commitments made by AI

## Build schedule

| Time | Outcome | Exit check |
| --- | --- | --- |
| 09:00–10:00 | Environment and Convex deployment | App opens, Auth keys exist, Context key is set |
| 10:00–11:30 | Core inbox loop | Seeded threads load and status/assignment mutations persist |
| 11:30–12:30 | Context.dev | Northstar company card enriches and survives refresh |
| 12:30–13:30 | AI drafting | Draft uses thread and company context; failures are user-readable |
| 13:30–15:00 | UI polish | Desktop and mobile paths are legible, fast, and presentation-ready |
| 15:00–16:00 | Collaboration details | Reply, waiting, closed, assignee, and labels feel coherent |
| 16:00–17:00 | QA and pitch | Fresh setup passes, demo rehearsed twice, backup recording ready |
| 17:00 onward | Buffer | Only fix demo blockers; do not expand scope |

## Planned architecture

```text
TanStack Start UI
  ├─ signed-out preview data
  └─ Convex React client + Auth v2
       ├─ inbox queries and mutations
       ├─ Agent + Convex AI Gateway → reply draft
       └─ Context.dev component → normalized companyProfiles
```

The intended UI should keep preview fixtures separate from persisted data. Once auth and the first schema exist, a setup mutation can create an isolated demo workspace and reactive Convex data can replace the fixtures.

Security boundaries:

- User IDs always come from Convex Auth identity, never client arguments.
- Every thread mutation checks workspace membership.
- Cross-workspace assignment is rejected.
- AI and Context.dev calls require a signed-in user before consuming paid services.
- Company API responses are reduced to fields the product uses.

## Candidate data model

This is a discussion aid, not a schema specification. Create only the tables required by the final judging story.

| Table | Purpose | Important index |
| --- | --- | --- |
| `users` | App-owned people created by Auth callbacks | `by_username` |
| `workspaces` | Tenant boundary | `by_slug` |
| `memberships` | Role and workspace access | `by_workspace_user` |
| `inboxes` | Sales, Accounts, Support | `by_workspace` |
| `threads` | Conversation state and routing | `by_workspace_last_message` |
| `messages` | Ordered inbound/outbound history | `by_thread_sent_at` |
| `labels`, `threadLabels` | Shared categorization | `by_thread_label` |
| `companyProfiles` | Persisted Context.dev summary | `by_domain` |

## Best uses of Context.dev

The recommended first use case is company identity: sender domain to title, description, and brand asset. It can improve the draft and give operators instant situational awareness.

Useful stretch ideas, in priority order:

1. A pre-call brief with company description, industry, and key public links.
2. Lead qualification signals from the company website, shown as suggestions rather than facts.
3. Tone grounding: use the customer’s public language to avoid a generic AI voice.
4. Visual trust cues such as the verified company logo and canonical domain.
5. Recent-site change alerts for account managers, only when Context.dev can support a reliable source.

Avoid broad scraping during the demo. One fast, understandable company card is stronger than a large wall of uncertain data.

## Acceptance checklist

- [ ] `bun run check-types`, `bun run test`, and `bun run build` pass from the repo root.
- [ ] The app loads at 1280 px and 390 px without clipped primary actions.
- [ ] Signed-out preview shows the complete Northstar story.
- [ ] Passkey sign-up creates only one workspace when repeated.
- [ ] A user cannot mutate another workspace.
- [ ] Context enrichment handles a missing key or API failure without breaking the inbox.
- [ ] AI generation cannot run while signed out and never sends automatically.
- [ ] A live-generated draft can be edited before sending.
- [ ] Refreshing the page retains workspace data and company context.
- [ ] The demo can be completed in under two minutes.

## Pitch outline

**Problem:** ordinary businesses manage customer work inside mailbox folders, forwarding chains, and tribal knowledge.

**Insight:** the unit of work is not the email; it is the owned conversation and its next action.

**Product:** Reply combines a shared queue, company intelligence, and careful AI drafting in one calm interface.

**Technical edge:** Convex makes every assignment, status, and draft reactive; Auth v2 gives passkey access; AI Gateway removes provider-key plumbing; Context.dev makes an unfamiliar sender understandable at the moment it matters.

**Next step:** connect Gmail and Microsoft Graph after validating that teams prefer this workflow over their existing shared mailbox.

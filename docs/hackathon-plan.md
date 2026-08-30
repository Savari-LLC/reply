# Reply: one-day hackathon plan

> Planning document only. The starter repository deliberately has an empty product schema and no Reply feature implementation.

## Hackathon rules and agent operating constraints

This build is for the Collabute X TheBlock hackathon at TheBlock, Dubai, on 30 August 2026. Development runs from 10:30 AM to 5:00 PM GST. The 5:00 PM submission cutoff is strict.

Every agent working in this repository must protect these constraints:

- Ship one stable core journey before adding breadth. A local prototype is acceptable; deployment is optional.
- Use test or synthetic data only. Do not add anything that enables fraud or harm.
- Build the product during the event. Prepared libraries, design systems, and generic starter code are allowed, but a pre-built product is not.
- Disclose major pre-existing components in the submission.
- Flag integration failures as soon as they appear. Preserve a working demo path while attempting stretch work.
- Do not make a partner integration decorative. Installing an SDK or mentioning a tool in the pitch does not count.

### Required partner integrations

The eligible product must make meaningful use of all three partners:

| Partner | Required contribution | Evidence to preserve |
| --- | --- | --- |
| Devin by Cognition | Devin must build substantial parts of the product. Assign it bounded implementation work that lands in the repository. | Keep a short record of the features, files, or commits Devin produced so the team can explain its work. |
| Convex | Convex must power the realtime backend through real tables, queries, mutations, and live UI updates. | Demo a state change such as assignment, reply, or status that persists and updates the interface. |
| Context.dev | Context.dev must provide web context used by the product, such as sender-domain company intelligence. | Demo a real Context.dev result in the company card and use the normalized result when generating a reply draft. |

Other models, APIs, and libraries may support the product, but they cannot replace these three integrations.

Partner setup references:

- Devin: [product](https://devin.ai), [documentation](https://docs.devin.ai), and [hackathon credits](https://www.devinvendingmachine.com/)
- Convex: [product](https://convex.dev), [documentation](https://docs.convex.dev), and [sponsored hackathon guide](https://convex-dev.notion.site/Convex-Sponsored-Hackathons-Guide-286b57ff32ab80daaa12dc4f8853f621)
- Context.dev: [product](https://context.dev), [documentation](https://docs.context.dev), and [credit redemption](https://www.context.dev/dashboard/redeem-credits) using code `COLLABUTE-CONTEXT-DEV`

### Judging priorities

Use the scoring weights to settle scope decisions:

| Criterion | Weight | Planning consequence |
| --- | ---: | --- |
| Product Value | 25% | Make the shared-inbox problem and target user obvious in the first 30 seconds. |
| Technical Execution | 25% | Prefer a reliable end-to-end flow, clean failure states, and persisted data over extra screens. |
| Partner Technology Integration | 25% | Make each partner's contribution visible in the product and easy to explain. |
| Innovation | 15% | Emphasize the combination of shared ownership, live company context, and assisted drafting. |
| Demonstration and Clarity | 10% | Rehearse one three-minute story and keep a backup recording. |

### Submission requirements

Submit through [the hackathon submission site](https://collabute-hackathon.vercel.app) before 5:00 PM GST. Prepare these fields before final QA:

- Project name
- One-line description
- Problem being solved
- Target users
- One paragraph each describing how Devin, Convex, and Context.dev were used
- Repository link
- Optional demo and video links
- Disclosure of pre-existing assets

The three-minute presentation should cover the problem, the product, the working core journey, how all three partner tools contributed, and the potential impact.

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
| 10:30 to 11:00 | Environment and partner setup | App opens; Convex, Context.dev, and Devin access are confirmed |
| 11:00 to 12:15 | Core inbox loop | Seeded threads load and status or assignment mutations persist |
| 12:15 to 1:00 | Context.dev | Northstar company card enriches and survives refresh |
| 1:00 to 2:00 | AI drafting | Draft uses thread and company context; failures are user-readable |
| 2:00 to 3:15 | UI polish | Desktop and mobile paths are legible, fast, and presentation-ready |
| 3:15 to 4:00 | Integration freeze | The complete demo path works; only demo blockers may change core code |
| 4:00 to 4:35 | QA and pitch | Fresh setup passes, demo is rehearsed twice, and a backup recording exists |
| 4:35 to 4:50 | Submission | All required fields and links are entered and checked |
| 4:50 to 5:00 | Final safety margin | Submit before the cutoff; do not start new work |

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

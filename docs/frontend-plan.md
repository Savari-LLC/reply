# Reply MVP frontend plan

**Branch:** `codex/mvp-frontend`

**Estimated effort:** 5–6 hours

**Primary directory:** `apps/web/src/features/inbox/**`

## Mission

Build a polished desktop shared-inbox experience around the complete Northstar workflow. Develop against a local fixture data source so frontend work does not wait for backend functions.

## Scope boundaries

- Optimize for desktop at 1280–1440 px.
- Do not build mobile navigation or mobile-specific layouts.
- Do not implement authentication UI.
- Use local seeded fixtures during this branch.
- Demonstrate a canned but editable Copilot draft.
- Treat Send as a simulated state transition.

## Figma reference assessment

Use the selected [Reply Figma frame](https://www.figma.com/design/zLUYI1PMKdsOujE2zt5j0M/Reply?node-id=16304-1096&p=f) as the primary visual reference for the desktop shell and message interactions.

### Use in the MVP

- Full-height three-column inbox layout
- Compact inbox and thread navigation
- Thread-list tabs and clear selected rows
- Conversation header with labels, priority, viewers, assignment, and a prominent Done action
- Full-width white inbound email cards
- Right-aligned teal outbound reply bubbles
- Inline reply composer at the bottom of the thread
- Neutral canvas, white elevated surfaces, fine borders, and restrained shadows
- Teal primary actions with small colored labels and status indicators
- “You’re all caught up” style empty state

### Adapt for the MVP

- Replace the reference’s personal mailbox and multiple shared accounts with Sales, Accounts, and Support.
- Use All, Open, Waiting, and Done as thread-list tabs.
- Display backend `closed` as Done without renaming the API value.
- Keep the assignment menu in the conversation header, with Unassigned supported.
- Adapt the reference People side panel into a single company-context panel. It opens from the company control in the header and shows only the seeded company profile.
- Keep the composer’s location and hierarchy, but reduce it to an editable textarea, Draft with Copilot, and Send.
- Use initials when no avatar asset exists.
- Make the fixed 1512 px reference layout fluid between 1280 and 1440 px.

### Do not build

- Personal Open, Mine, Sent, or Snoozed navigation
- Multiple email accounts
- New-message composition
- Attachments or attachment previews
- To, Cc, Bcc, subject, or rich-text composer controls
- People and Files features
- Internal comment/reply mode
- Presence collaboration beyond optional decorative avatars
- The unfinished AI Reply and Assignment Control component-page placeholders
- Pixel-perfect replication of the large fixed Figma canvas

## File ownership

The frontend developer owns:

- `apps/web/src/features/inbox/model.ts`
- `apps/web/src/features/inbox/inbox-screen.tsx`
- Components under `apps/web/src/features/inbox/components/**`
- `apps/web/src/features/inbox/fixture-inbox-page.tsx`
- `apps/web/src/features/inbox/fixture-data.ts`
- `apps/web/src/features/inbox/inbox.css` if feature-scoped tokens are needed
- `apps/web/src/routes/index.tsx` until frontend handoff
- Frontend-only tests under the same feature directory if added

The frontend developer should avoid modifying:

- `packages/backend/**`
- `packages/backend/convex/_generated/**`
- `packages/ui/**` unless a missing primitive is genuinely blocking
- `apps/web/src/routes/__root.tsx` unless a metadata change is essential

Prefer composing existing shared UI components rather than modifying them. This keeps the frontend branch disjoint from backend and limits integration conflicts.

## Integration seam

The screen must not call Convex directly. It should receive data and callbacks through props or a controller object defined in `model.ts`.

Recommended shape:

```ts
type InboxController = {
  state: InboxScreenState;
  selectInbox: (inboxId: string) => void;
  selectThread: (threadId: string) => void;
  assignThread: (threadId: string, teammateId: string) => Promise<void>;
  setStatus: (threadId: string, status: ThreadStatus) => Promise<void>;
  setUnread: (threadId: string, unread: boolean) => Promise<void>;
  setPriority: (threadId: string, priority: ThreadPriority) => Promise<void>;
  setLabels: (threadId: string, labels: string[]) => Promise<void>;
  generateDraft: (threadId: string) => Promise<string>;
  sendReply: (threadId: string, body: string) => Promise<void>;
};
```

`fixture-inbox-page.tsx` owns local state and implements this controller. The integration developer will later add `convex-inbox-page.tsx` implementing the same interface.

Do not import `@reply/backend/convex/_generated/api` anywhere in the visual components.

## Frozen view model

Use string IDs at the UI boundary. The integration adapter converts Convex IDs to this view model without casts inside visual components.

```ts
type ThreadStatus = "open" | "waiting" | "closed";
type ThreadPriority = "normal" | "urgent";
type MessageDirection = "inbound" | "outbound";
```

The screen state must contain:

- Inboxes with ID, name, slug, display order, and unread count
- Teammates with ID, name, initials, optional avatar, and role
- Thread summaries with customer, subject, preview, status, priority, assignee, labels, unread state, and timestamp
- Selected thread with ordered messages and optional company profile
- Selected inbox and thread IDs
- Initial-loading, mutation-loading, draft-loading, and error state

Keep `model.ts` free of React, Convex, and fixture-specific imports so the integration adapter can reuse it cleanly.

## Component structure

```text
InboxScreen
├── InboxSidebar
├── ThreadList
└── ConversationWorkspace
    ├── ConversationHeader
    ├── MessageTimeline
    │   ├── InboundEmailCard
    │   └── OutboundReplyBubble
    ├── CompanyProfileCard
    └── ReplyComposer
```

The company profile uses the reference’s optional right-panel behavior inside `ConversationWorkspace`; it does not add a fourth global application column.

## Visual specification

- Combine the narrow utility rail and inbox navigation into a 220–240 px first column.
- Use a 330–360 px thread-list column.
- Let the conversation column consume the remaining width with `min-width: 0`.
- Use independent vertical scrolling for navigation, thread list, and conversation.
- Use the reference neutral canvas (`#F0F0F0`), white surfaces, subtle 1 px borders, and a teal semantic primary action.
- Prefer 8 px and 16 px spacing increments, compact 12–14 px supporting text, and readable 14–16 px message text.
- Keep borders and small radius changes more prominent than heavy shadows.
- Reuse existing shadcn components and matching Lucide glyphs instead of recreating a parallel component library.
- Keep company context in a 240–280 px optional panel within the conversation area. It should default closed but be opened during the judging story.
- Keep the composer visually anchored to the bottom of the conversation pane.

## Implementation sequence

### F0: Model and fixture milestone

Target: first 30–45 minutes.

- Define the view model and `InboxController` interface.
- Add realistic fixtures matching the frozen backend contract.
- Add a local controller with successful and failure states.
- Commit this milestone separately.
- Notify the integration developer that the UI contract is ready.

Suggested commit message:

```text
feat(frontend): establish inbox UI contract and fixtures
```

### F1: Inbox shell

- Replace the starter route with `FixtureInboxPage`.
- Build a stable three-column desktop shell.
- Keep navigation, list, and conversation areas independently scrollable.
- Provide a strong selected state and visual hierarchy.
- Match the reference’s neutral canvas, white panels, fine dividers, compact density, and teal actions.

### F2: Inbox sidebar and thread list

Inbox sidebar:

- Sales, Accounts, and Support
- Unread counts
- Clear selected state
- Avoid the reference’s personal mailbox, Sent, and Snoozed sections

Thread list:

- Sender and company
- Subject and latest-message preview
- Assignee avatar or initials
- Urgent indicator
- Labels, status, unread state, and timestamp
- Northstar first in Sales
- All, Open, Waiting, and Done filter tabs
- Selected row styling patterned after the reference

### F3: Conversation workspace

- Customer and subject header
- Ordered inbound and outbound message bubbles
- Assignment selector
- Status and priority controls
- Label editing or selection
- Read/unread action
- Company profile with logo, description, domain, and fallbacks
- Header-level company-context toggle using the reference side-panel behavior
- Prominent Done action mapped to `closed`
- Full-width inbound email cards and right-aligned teal outbound replies

### F4: Reply Copilot composer

- “Draft with Copilot” button
- Visible loading state
- Draft inserted into an editable textarea
- Send disabled while empty or submitting
- No autonomous sending
- Success feedback after sending
- Draft errors that leave manual composition usable
- No attachment, address-header, subject, or rich-text controls

### F5: Presentation and accessibility

- Skeletons for initial loading
- Empty inbox and no-selection states
- Disabled controls during pending work
- Toasts or inline messages for failures
- Visible keyboard focus
- Accessible names for icon-only controls
- Readable long-message layout
- No clipped primary actions at 1280 px
- Company-context panel can open without making messages or Send unusable

### F6: Frontend handoff

Run:

```bash
bun run check-types
bun run build
```

Then commit the completed fixture-driven UI before integration begins editing the route.

## Avoiding merge friction

- Keep all feature components inside `apps/web/src/features/inbox/**`.
- Keep Convex imports out of visual components.
- Make `apps/web/src/routes/index.tsx` a thin wrapper around `FixtureInboxPage`.
- After the handoff commit, the integration developer owns the final route swap.
- Send later UI fixes through the frontend branch, then let integration merge them.
- Avoid rebasing after integration has merged the branch.

## Exit criteria

- The entire Northstar story works using fixtures.
- The screen depends only on the reusable controller interface.
- Loading, empty, success, and failure states are visible.
- The canned draft can be generated, edited, and sent.
- The desktop presentation is polished at 1280–1440 px.
- Type checking and build pass.

# Reply MVP frontend plan

**Branch:** `codex/mvp-frontend`

**Estimated effort:** 5–6 hours

**Primary directory:** `apps/web/src/features/inbox/**`

## Mission

Build a polished desktop shared-inbox experience around the complete Northstar workflow. Develop against a local fixture data source so frontend work does not wait for backend functions.

## Plan synchronization boundary

Keep this plan synchronized with the current branch-ready MVP documents:

- `docs/mvp-plans.md`
- `docs/backend-plan.md`
- `docs/integration-plan.md`

Only these documents define the current scope. Historical planning documents must not expand it.

## Scope boundaries

- Optimize for desktop at 1280–1440 px.
- Do not build mobile navigation or mobile-specific layouts.
- Do not implement authentication UI.
- Use local seeded fixtures during this branch.
- Demonstrate a canned but editable Copilot draft.
- Treat Send as a simulated state transition.
- Keep the backend values `open`, `waiting`, and `closed`; display `closed` as Done.
- Do not make paid AI or Context.dev calls from the fixture frontend.

## Figma reference assessment

Use the supplied [ReplyFlow empty-state frame](https://www.figma.com/design/hpFdpg0Owjx8gaZZ9J6gK5/Reply--Copy-?node-id=16306-14380&m=dev) as the primary reference for the application shell, empty-state treatment, spacing, radii, and color system.

Inspect these nearby frames on the same Design page for interaction and layout details:

| Figma frame | Use in the MVP |
| --- | --- |
| `ReplyFlow / Empty state` (`16306:14380`) | Shell, neutral canvas, centered empty state, surface treatment |
| `ReplyFlow / Comment replying` (`16306:3541`) | Three-pane proportions, thread rows, header density, anchored input |
| `ReplyFlow / Chat` (`16351:7468`) | Date separators, right-aligned teal replies, long conversation rhythm |
| `ReplyFlow / Composer` (`16306:10791`) | Composer placement, pending activity placement, disabled-action treatment |
| `ReplyFlow / Mail reply` (`16351:8019`) | Sent-message presentation and header popover behavior |
| `ReplyFlow / Open right panel / People` (`16329:29807`) | Optional right-panel width and workspace compression behavior |

The neighboring frames are references, not scope additions. Do not inherit comments, attachments, rich-text controls, people lists, personal mailbox navigation, or presence features from them.

### Figma-derived palette and tokens

Define these values as feature-scoped tokens in `inbox.css`; do not change the application-wide theme or `packages/ui` solely for this screen.

| Role | Figma value | Usage |
| --- | --- | --- |
| App canvas | `#F0F0F0` | Outer shell and conversation background |
| Subtle navigation | `#F5F5F5` | Utility rail and navigation groups |
| Surface | `#FAFAFA` | Panels, cards, composer, popovers |
| Border | `#E6E6E6` | One-pixel dividers and control outlines |
| Strong text | `#000000` | Page and conversation titles |
| Default text | `#262626` | Body and control labels |
| Muted text | `#737373` | Timestamps, metadata, descriptions |
| Primary teal | `#0D9488` | Primary actions, links, outbound replies |
| Success | `#22C55E` | Online or success indicators only |

- Use the reference spacing rhythm of 4, 8, 12, 16, and 32 px.
- Use 8 px controls, 12 px major surfaces, and 24 px only for the outer application frame.
- Use the existing destructive semantic token for failures and urgent states instead of introducing a separate red palette.
- Treat magenta, purple, amber, yellow, and blue inbox markers as decorative category accents. Pair every color with a readable label or icon.
- Preserve accessible text contrast; never use muted text for essential actions or error messages.

### Use in the MVP

- Full-height three-column inbox layout
- Compact inbox and thread navigation
- Thread-list tabs and clear selected rows
- Conversation header with labels, priority, assignment, and a prominent Done action
- Full-width white inbound email cards
- Right-aligned teal outbound reply bubbles
- Inline reply composer anchored to the bottom of the thread
- Neutral canvas, light elevated surfaces, fine borders, and restrained shadows
- Teal primary actions with small colored labels and status indicators
- “You’re all caught up” empty-state hierarchy without the out-of-scope Figma actions

### Adapt for the MVP

- Replace the reference’s personal mailbox and multiple shared accounts with Sales, Accounts, and Support.
- Use All, Open, Waiting, and Done as thread-list tabs.
- Display backend `closed` as Done without renaming the API value.
- Show Unassigned when the assignee is null. The frozen backend supports assigning a teammate but does not expose a clear-assignment mutation, so the menu must not promise that action.
- Adapt the reference People side panel into a single company-context panel. It opens from the company control in the header and shows only the seeded company profile.
- Keep the composer’s location and hierarchy, but reduce it to an editable textarea, Draft with Copilot, and Send.
- Use initials when no avatar asset exists.
- Make the fixed 1512 px reference layout fluid between 1280 and 1440 px.
- Replace the reference empty-state actions with actions that exist in MVP scope: Clear filters, Retry, or no action.

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
- `apps/web/src/features/inbox/inbox.css`
- `apps/web/src/routes/index.tsx` until frontend handoff
- Frontend-only tests under the same feature directory if added

The frontend developer should avoid modifying:

- `packages/backend/**`
- `packages/backend/convex/_generated/**`
- `packages/ui/**` unless a missing primitive is genuinely blocking
- `apps/web/src/routes/__root.tsx`

The root route already mounts `@reply/ui/components/sonner` at the bottom right. Do not mount a second Toaster. Reuse the existing Empty, Skeleton, Spinner, Alert, Button, Select, Textarea, Avatar, Badge, Sheet, and related shared primitives before creating feature-specific equivalents.

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
  retryLoad: (scope: "screen" | "list" | "thread") => Promise<void>;
};
```

`fixture-inbox-page.tsx` owns local state and implements this controller. The integration developer will later add `convex-inbox-page.tsx` implementing the same interface.

Do not import `@reply/backend/convex/_generated/api` anywhere in the visual components. Keep toast calls at the page/controller boundary so fixture and Convex modes do not emit duplicate notifications.

## Frozen view model

Use string IDs at the UI boundary. The integration adapter converts Convex IDs to this view model without casts inside visual components.

```ts
type ThreadStatus = "open" | "waiting" | "closed";
type ThreadPriority = "normal" | "urgent";
type MessageDirection = "inbound" | "outbound";
type AsyncStatus = "idle" | "loading" | "success" | "error";
type OperationKey = "assign" | "status" | "unread" | "priority" | "labels" | "draft" | "send";

type OperationState = {
  status: AsyncStatus;
  message?: string;
};
```

The screen state must contain:

- Inboxes with ID, name, slug, display order, and unread count
- Teammates with ID, name, initials, optional avatar, and role
- Thread summaries with customer, subject, preview, status, priority, assignee, labels, unread state, and timestamp
- Selected thread with ordered messages and optional company profile
- Selected inbox and thread IDs
- Screen status: loading, ready, or error
- Thread-list status: idle, loading, ready, empty, or error
- Thread status: idle, loading, ready, or error
- Per-operation state keyed by `OperationKey`, rather than one global mutation boolean
- Scope-specific, user-readable error messages with technical details excluded

Keep `model.ts` free of React, Convex, Sonner, and fixture-specific imports so the integration adapter can reuse it cleanly.

## State and feedback contract

Loading, empty, and error behavior is part of each feature phase. F5 verifies these states; it must not be the first phase that implements them.

| State | Placement | Required behavior | Feedback channel |
| --- | --- | --- | --- |
| Initial screen load | Entire inbox shell | Render stable sidebar, thread-list, header, message, and composer skeleton geometry; set `aria-busy`; avoid a blank page or layout jump | Inline skeletons, no toast |
| Background revalidation | Affected pane | Keep confirmed content visible; show only a subtle pane or control indicator | Inline spinner, no toast |
| Thread-list error | Thread list | Keep the selected inbox and sidebar usable; explain that conversations could not load and provide Retry | Inline pane error |
| Thread load | Conversation workspace | Keep sidebar and thread list usable; skeleton only the selected workspace | Workspace skeleton, no toast |
| Empty inbox | Thread list and workspace | Show “You’re all caught up” and identify the selected inbox; do not offer New conversation | Inline empty state |
| Empty filter | Thread list | State that no conversations match and provide Clear filters | Inline empty state with action |
| No selected thread | Conversation workspace | Prompt “Select a conversation to view details”; do not imply the inbox is empty | Inline empty state |
| Blocking screen error | Entire shell content | Preserve the outer shell, explain that the inbox could not load, and provide Retry | Inline alert/error state |
| Thread error | Conversation workspace | Keep navigation and list visible; provide Retry for the selected thread | Inline pane error |
| Mutation pending | Triggering control | Disable only the conflicting control and prevent duplicate requests; keep the rest of the thread usable | Control spinner, no loading toast |
| Mutation failure | Triggering feature | Restore last confirmed state if optimistic UI was used; keep selection and scroll position | Sonner error with Retry when safe |
| Draft loading | Composer | Change the draft action to “Drafting…” with a spinner; keep manual typing available | Inline control state |
| Draft failure | Composer | Preserve existing text and manual composition; show Retry beside the draft action | Inline message, no toast |
| Send pending | Composer | Capture the submitted body, prevent double send, and do not clear the textarea yet | Send-button spinner |
| Send success | Timeline and composer | Clear only after confirmation, append exactly one outbound message, and reflect Waiting | Sonner success |
| Send failure | Composer | Preserve the full draft, restore editing and focus, and allow retry | Sonner error with Retry |
| Missing company profile | Company panel | Render domain/name fallbacks and a concise unavailable message without affecting the conversation | Inline panel state, no toast |

Use one primary feedback channel for each event. Do not repeat the same error in both an inline alert and a toast.

## Sonner toast policy

The root Toaster already exists. Import `toast` from `sonner` only in the controller/page layer and use stable IDs so repeated requests cannot stack duplicate messages.

Use toasts for:

- Successful send: “Reply sent” with “Conversation moved to Waiting.”
- Successful Done action: “Conversation marked Done.”
- Recoverable assignment, status, unread, priority, or label failures with a safe Retry action.
- Send failure with a Retry action that reuses the preserved draft.

Do not toast:

- Initial loading, thread loading, or background revalidation
- Inbox selection, thread selection, or filter changes
- Draft success
- Empty states
- Validation such as an empty reply
- Initial query, thread query, draft, or company-profile errors that already have a local recovery surface

Keep messages short, specific, and non-technical. Never display raw Convex or JavaScript error strings.

## Component structure

```text
InboxScreen
├── InboxShellSkeleton | ScreenErrorState
├── InboxSidebar
├── ThreadList
│   └── ThreadListState (loading | empty | error)
└── ConversationWorkspace
    ├── NoSelectionState | ThreadSkeleton | ThreadErrorState
    ├── ConversationHeader
    ├── MessageTimeline
    │   ├── InboundEmailCard
    │   └── OutboundReplyBubble
    ├── CompanyProfilePanel
    └── ReplyComposer
        └── ComposerOperationState
```

The company profile uses the reference’s optional right-panel behavior inside `ConversationWorkspace`; it does not add a fourth global application column.

## Visual specification

- Treat the Figma layout as a 48 px utility rail plus a 200 px inbox navigation region. Implement them together as a fluid 224–248 px first column.
- Use a fluid 288–320 px thread-list column, close to the nearby Figma frames’ 300 px list.
- Let the conversation column consume the remaining width with `min-width: 0`.
- Use independent vertical scrolling for navigation, thread list, and conversation.
- Use the feature-scoped Figma palette instead of changing the global application theme.
- Use compact 12–14 px supporting text and readable 14–16 px message text.
- Keep borders and small radius changes more prominent than heavy shadows.
- Reuse existing shared components and matching Lucide glyphs instead of recreating a parallel component library.
- Keep company context in a 240–280 px optional panel within the conversation area. It defaults closed but opens during the judging story.
- Keep the composer visually anchored to the bottom of the conversation pane.
- Preserve at least 520 px for conversation content when the company panel is open at 1280 px; compress the navigation and list within their allowed ranges first.
- Match hierarchy and behavior at 1280 and 1440 px. Use the 1512 px Figma frame only as a visual comparison reference.

## Implementation sequence

### F0: Model, state contract, and fixture milestone

Target: first 30–45 minutes.

- Define the view model and `InboxController` interface, including `retryLoad`.
- Add realistic fixtures matching the frozen backend contract.
- Model screen, thread, and per-operation state explicitly; avoid a single catch-all loading or error boolean.
- Add deterministic fixture scenarios for ready, initial loading, screen error, list loading, list error, empty inbox, empty filter, thread loading, thread error, mutation error, draft error, send error, and missing company profile.
- Make scenarios selectable through fixture configuration or a development-only query parameter, not through controls visible in the judging flow.
- Resolve and reject fixture actions asynchronously so pending UI can be verified.
- Commit this milestone separately.
- Notify the integration developer that the UI and async-state contract is ready.

F0 exit checks:

- Every state in the state-and-feedback table can be reached without editing source code.
- Fixture failures preserve the last confirmed thread state.
- Visual components import no Convex, fixture, or Sonner modules.

Suggested commit message:

```text
feat(frontend): establish inbox UI contract and fixtures
```

### F1: Visual tokens, inbox shell, and bootstrap states

- Replace the starter route with `FixtureInboxPage`.
- Add feature-scoped palette, spacing, and radius tokens in `inbox.css`.
- Build a stable three-column desktop shell with independent pane scrolling.
- Implement the initial shell skeleton before wiring ready content.
- Implement a shell-level load error with user-readable copy and Retry.
- Keep the shell geometry stable between loading, error, empty, and ready states.
- Provide strong selected states, visible keyboard focus, and a coherent compact hierarchy.

F1 exit checks:

- Loading-to-ready produces no visible column jump at 1280 or 1440 px.
- The screen-level Retry returns from the error fixture to ready content.
- The palette matches the supplied Figma frame without global token changes.

### F2: Inbox sidebar, thread list, and list states

Inbox sidebar:

- Sales, Accounts, and Support
- Unread counts
- Clear selected state
- Avoid the reference’s personal mailbox, Sent, Snoozed, and New Message controls

Thread list:

- Sender and company
- Subject and latest-message preview
- Assignee avatar or initials
- Urgent indicator with a non-color label or accessible name
- Labels, status, unread state, and timestamp
- Northstar first in Sales
- All, Open, Waiting, and Done filter tabs
- Selected row styling patterned after the reference

List states:

- Use row-shaped skeletons that preserve the final avatar, text, label, and timestamp geometry.
- Show “You’re all caught up” when the selected inbox has no threads, with the inbox name in the description and no out-of-scope action.
- Show “No conversations match this filter” with Clear filters when data exists but the active tab has no results.
- Keep the selected inbox visible if the thread list fails, and show a pane-local Retry.
- Do not reset the current filter or selected inbox during a background refresh.

F2 exit checks:

- All, Open, Waiting, and Done produce correct fixture subsets.
- Empty inbox and empty filter are visually and semantically distinct.
- Thread rows do not shift when unread, urgent, label, or assignee metadata is absent.

### F3: Conversation workspace, company context, and mutations

- Add the customer and subject header.
- Render ordered inbound and outbound messages using full-width inbound cards and right-aligned teal replies.
- Add assignment, status, priority, label, and read/unread controls.
- Add a prominent Done action mapped to backend `closed`.
- Add the company profile with logo, description, domain, and safe field fallbacks.
- Add the header-level company-context toggle using the nearby right-panel behavior.
- Implement no-selection, thread-loading, thread-error, and missing-company states before considering the workspace complete.
- Disable only the control responsible for an active mutation.
- Preserve scroll position, selected thread, and confirmed content after mutation failure.
- Emit the approved success or failure toast only after the controller promise settles.

F3 exit checks:

- The workspace never blanks while switching or revalidating a thread.
- A failed mutation leaves every unrelated action usable.
- The Done action shows `closed` as Done and emits one success toast.
- Opening the company panel at 1280 px keeps messages and the composer usable.

### F4: Reply Copilot composer, send lifecycle, and toast behavior

- Add an editable textarea, Draft with Copilot, and Send.
- Keep manual composition available while a draft is generating.
- Show “Drafting…” and a spinner only on the draft action.
- Insert a successful draft without sending it and leave it fully editable.
- Show draft failure inline beside the draft action; preserve any existing text and provide Retry.
- Trim only for empty-value validation; do not silently rewrite the user’s draft.
- Disable Send when the draft is empty or a send is pending.
- Preserve the submitted body until `sendReply` resolves successfully.
- On success, append one outbound message, clear the composer, move the thread to Waiting, and emit one “Reply sent” toast.
- On failure, preserve the draft, restore focus, re-enable Send, and emit one recoverable error toast.
- Do not add attachment, address-header, subject, rich-text, internal-comment, or autonomous-send controls.

F4 exit checks:

- Repeated clicks cannot generate duplicate drafts or replies.
- Draft failure never prevents manual typing or sending.
- Send failure loses no characters.
- Success and failure produce one notification each, with no loading toast.

### F5: State QA, presentation, and accessibility

- Exercise every deterministic fixture scenario from F0.
- Add `aria-busy` to loading regions and `role="alert"` or an appropriate live region to persistent inline errors.
- Keep visible keyboard focus on tabs, thread rows, header actions, panel controls, textarea, and Send.
- Give icon-only controls accessible names and decorative icons `aria-hidden`.
- Move focus to the conversation heading after a deliberate keyboard thread selection without stealing focus during revalidation.
- Return focus to the company-panel trigger when the panel closes.
- Respect reduced-motion preferences for feature-owned skeletons, spinners, and panel transitions; verify that the shared Sonner presentation remains usable with reduced motion enabled.
- Verify long subjects, customer names, labels, message bodies, and generated drafts wrap without clipping.
- Verify error text and status indicators do not rely on color alone.
- Confirm bottom-right Sonner toasts do not obscure Send or essential conversation controls at 1280 px.
- Compare ready, empty, composer, sent-reply, and open-panel states with the supplied Figma frame and nearby variants.

F5 exit checks:

- No clipped primary actions at 1280 or 1440 px.
- The interface remains understandable using only the keyboard and visible text.
- Loading, empty, error, success, and retry paths are presentation-ready.

### F6: Frontend handoff

Run from the repository root:

```bash
bun run check-types
bun run test
bun run build
```

Then:

- Run the full Northstar story in the ready fixture.
- Run the initial-load, list-error, empty-inbox, empty-filter, thread-error, mutation-error, draft-error, send-error, and missing-company fixtures.
- Verify the shell and company panel at both 1280 and 1440 px.
- Commit the completed fixture-driven UI before integration begins editing the route.

## Avoiding merge friction

- Keep all feature components inside `apps/web/src/features/inbox/**`.
- Keep Convex imports out of visual components.
- Keep Sonner orchestration out of `model.ts` and presentational components.
- Make `apps/web/src/routes/index.tsx` a thin wrapper around `FixtureInboxPage`.
- Do not add another Toaster or edit the root route for notifications.
- After the handoff commit, the integration developer owns the final route swap.
- Send later UI fixes through the frontend branch, then let integration merge them.
- Avoid rebasing after integration has merged the branch.

## Exit criteria

- The entire Northstar story works using fixtures.
- The screen depends only on the reusable controller interface.
- Loading, background-loading, empty, success, and failure states are deterministic and visibly distinct.
- Empty inbox, empty filter, and no-selection states use accurate copy and actions.
- Failed mutations preserve confirmed content; failed sends preserve the complete draft.
- Sonner is used only for the approved cross-pane successes and recoverable mutations, with no duplicate Toaster.
- The canned draft can be generated, edited, retried, and sent.
- The desktop presentation follows the supplied Figma palette and nearby frame behavior at 1280–1440 px.
- Type checking, tests, and build pass.

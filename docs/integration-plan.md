# Reply MVP integration and demo QA plan

**Branch:** `codex/mvp-integration`

**Estimated effort:** 3–4 hours after initial handoffs

**Role:** convergence branch and final demo owner

## Mission

Connect the backend and frontend tracks into one repeatable two-minute demo, verify the complete flow, and deliver the branch that converges both developers’ work with minimal conflicts.

## Branch strategy

Create this branch from the same main-branch commit as the backend and frontend branches.

The integration developer should not independently recreate backend functions or frontend components. Instead:

1. Review both frozen contracts immediately.
2. Prepare the adapter design and QA checklist while the other branches build.
3. Merge the backend B0 contract commit when available.
4. Merge the complete backend branch when ready.
5. Merge the frontend F0 contract commit, or wait for its completed branch if the interval is short.
6. Merge the complete frontend branch before final wiring.
7. Add the Convex adapter and perform the single route swap.

This branch is expected to contain both feature branches in its history. Do not squash their commits inside the integration branch.

## File ownership

Before merging the other branches, integration owns only new, non-overlapping files such as:

- `apps/web/src/features/inbox/convex-inbox-page.tsx`
- `apps/web/src/features/inbox/use-convex-inbox-controller.ts`
- Integration-specific verification notes or scripts if needed

After merging the completed frontend branch, integration also owns the final small edit to:

- `apps/web/src/routes/index.tsx`

Integration should not modify:

- Convex schema or public API names without coordinating with backend
- Visual component markup unless fixing a demonstrated integration bug
- Shared UI primitives for feature-specific styling
- Generated Convex files by hand

## Frozen contract audit

Confirm that both branches agree on:

```ts
type ThreadStatus = "open" | "waiting" | "closed";
type ThreadPriority = "normal" | "urgent";
type MessageDirection = "inbound" | "outbound";
```

Confirm these Convex functions exist:

- `demo:getState`
- `demo:ensureSeeded`
- `inboxes:list`
- `teammates:list`
- `threads:list`
- `threads:get`
- `threads:assign`
- `threads:setStatus`
- `threads:setUnread`
- `threads:setPriority`
- `threads:setLabels`
- `threads:sendReply`
- `drafts:generateDemo`

Confirm the frontend exposes an `InboxController` interface and that visual components have no direct Convex dependency.

Confirm the Figma vocabulary is presentation-only:

- Backend `closed` displays as Done.
- A missing assignee displays as Unassigned.
- Filter tabs operate on existing thread data and do not introduce new backend statuses.
- Inbound and outbound rendering comes from `MessageDirection`.
- The company-context panel uses the existing `companyProfile` result.

If a contract mismatch appears, fix it at the source branch first whenever practical, then merge that fix into integration. Avoid maintaining permanent translation hacks for simple naming differences.

## Implementation sequence

### I0: Parallel preparation

While backend and frontend build:

- Document the expected Northstar demo sequence.
- Identify the route swap and adapter files.
- Review loading and failure requirements.
- Confirm environment variables and Convex connectivity.
- Do not make speculative edits to files owned by the other branches.

### I1: Merge the backend contract milestone

- Merge the backend B0 commit or current backend branch.
- Run Convex type generation if the backend developer has not already committed generated output.
- Confirm public function names and result types.
- Report contract differences before either branch builds more assumptions on them.

### I2: Merge completed feature branches

Merge backend first:

```bash
git merge --no-ff codex/mvp-backend
```

Then merge frontend:

```bash
git merge --no-ff codex/mvp-frontend
```

Expected conflicts should be near zero because backend and frontend own different directories. If `apps/web/src/routes/index.tsx` conflicts, keep the frontend version first; the live route swap happens in I4.

### I3: Build the Convex controller

Implement the frontend `InboxController` using generated Convex APIs:

- Call `demo:getState` on entry.
- Invoke `demo:ensureSeeded` once when data is absent.
- Load inboxes and teammates.
- Load the selected inbox’s thread summaries.
- Load the selected thread detail.
- Map Convex IDs and documents into the frontend view model in one adapter layer.
- Wire assignment, status, priority, labels, and unread mutations.
- Wire `drafts:generateDemo` to the composer action.
- Wire `threads:sendReply` and clear the composer only after success.

Keep mutation loading and error state inside the controller. Visual components should not learn Convex implementation details.

### I4: Perform the route swap

Make one intentional edit to `apps/web/src/routes/index.tsx`:

- Replace `FixtureInboxPage` with `ConvexInboxPage`.
- Keep the route file thin.
- Do not delete the fixture page; it remains a useful fallback and visual test harness.

### I5: Verify reactivity and persistence

Confirm that:

- Inbox unread counts update after thread changes.
- Selected thread state updates without a manual reload.
- Sending adds exactly one outbound message.
- Sending moves the thread to Waiting.
- The draft remains editable before sending.
- Refresh preserves the selected data and backend state.
- Missing company fields render safe fallbacks.
- A failed mutation leaves the UI usable.
- All, Open, Waiting, and Done tabs filter the current inbox correctly.
- The Done action persists backend status `closed`.
- The company-context panel opens without obscuring the core reply action at 1280 px.
- Inbound email cards and outbound teal replies remain visually distinct after live data mapping.

### I6: Demo rehearsal

Required two-minute sequence:

1. Open Sales.
2. Select urgent Northstar.
3. Show its messages, owner, labels, and priority.
4. Show the seeded company profile.
5. Generate the canned context-aware draft.
6. Edit at least one sentence.
7. Send the simulated reply.
8. Confirm the outbound message appears.
9. Confirm the thread moves to Waiting.
10. Refresh and demonstrate persistence.

## Final verification

Run from the repository root:

```bash
bun run check-types
bun run test
bun run build
```

Manually verify:

- Fresh or empty database initialization
- No duplicate demo records after repeated setup
- Complete Northstar flow at 1280 px
- Visual comparison with the 1512 × 982 Figma reference at 1440 px
- Stable three-column proportions at both 1280 and 1440 px
- Company-context panel open and closed states
- All, Open, Waiting, and Done tabs
- Unassigned and assigned header states
- Distinct inbound and outbound message treatment
- Direct refresh after sending
- Empty draft rejection
- Mutation failure feedback
- Missing company-logo fallback
- Demo completion in under two minutes
- Two successful rehearsals
- Backup screen recording

## Figma acceptance boundary

The integration developer checks visual intent rather than pixel identity. The finished MVP should clearly inherit the reference’s shell, density, hierarchy, message treatment, assignment placement, Done prominence, composer location, and teal-on-neutral styling.

Do not block the merge for absent reference features that are outside scope: personal inboxes, multiple accounts, Sent, Snoozed, attachments, rich formatting, internal comments, People, Files, or mobile behavior.

## Final main-branch merge

The maintainer should merge in this order:

```bash
git merge --no-ff codex/mvp-backend
git merge --no-ff codex/mvp-frontend
git merge --no-ff codex/mvp-integration
```

The integration branch already contains the feature branches. Git should apply only its remaining adapter, wiring, and QA commits during the third merge.

After merging:

1. Run all root verification commands again on main.
2. Check that no conflict resolution restored the fixture route.
3. Confirm generated Convex files match the final schema.
4. Run the Northstar demo once from main.
5. Stop feature work and fix only demo blockers.

## Exit criteria

- Backend and frontend histories are merged without squashing.
- The production route uses the Convex controller.
- Fixture mode remains available as a fallback harness.
- The complete story is reactive and persists after refresh.
- Type checking, tests, and build pass on the convergence branch.
- The same checks pass after the final main-branch merge.

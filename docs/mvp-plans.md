# Reply MVP plans

The desktop-only, unauthenticated Reply MVP is split into three branch-ready plans:

1. [Backend plan](./backend-plan.md)
2. [Frontend plan](./frontend-plan.md)
3. [Integration and demo QA plan](./integration-plan.md)

## Parallel branch model

All three branches start from the same main-branch commit.

| Track | Suggested branch | Primary ownership |
| --- | --- | --- |
| Backend | `codex/mvp-backend` | `packages/backend/convex/**` |
| Frontend | `codex/mvp-frontend` | UI files under `apps/web/src/features/inbox/**` and the initial route shell |
| Integration | `codex/mvp-integration` | Convex UI adapter, final route wiring, end-to-end verification, and convergence merges |

The integration branch is the convergence branch. It merges backend and frontend work as their milestones become available, then adds only the wiring and QA changes.

## Frozen MVP boundaries

- Desktop presentation at 1280–1440 px
- Single seeded demo dataset
- No authentication, users, memberships, or workspace authorization
- No mobile-specific UI
- Simulated outbound sending only
- Seeded company profile and canned editable AI draft
- No unauthenticated paid Context.dev or AI calls
- No real email delivery, notes, activity history, AI triage, streaming, or keyboard shortcuts

## Figma reference decision

The selected frame in the [Reply Figma reference](https://www.figma.com/design/zLUYI1PMKdsOujE2zt5j0M/Reply?node-id=16304-1096&p=f) is a useful visual source, but it describes a broader email product than this MVP.

| Use directly | Adapt for Reply MVP | Defer |
| --- | --- | --- |
| Three-column desktop shell | Shared-account navigation becomes Sales, Accounts, and Support | Personal inbox and multiple accounts |
| Compact thread rows | `Done` is the UI label for backend status `closed` | Sent and Snoozed sections |
| Header assignment menu | Right-side People panel becomes a company-context panel | People and Files features |
| Distinct inbound cards and outbound teal messages | Full email composer becomes a simple AI-assisted reply composer | Attachments and rich-text controls |
| Subtle borders, white surfaces, neutral canvas, teal actions | Reference status tabs become All, Open, Waiting, and Done | Internal comments and notes |
| Empty and loading states | Reference desktop frame is made fluid from 1280–1440 px | Mobile layouts and unfinished component-library pages |

The frontend plan contains the implementation-level visual decisions. Backend values remain stable so the Figma vocabulary does not create contract churn.

## Final merge sequence

1. Merge `codex/mvp-backend` into main.
2. Merge `codex/mvp-frontend` into main.
3. Merge `codex/mvp-integration` into main.
4. Run the root verification commands and rehearse the Northstar demo.

Because the integration branch has already merged the other two branches, Git should recognize their commits during step 3 and apply only the integration delta.

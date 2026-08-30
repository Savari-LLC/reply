# Reply

Reply is the prepared base repository for a one-day hackathon build: a shared inbox concept for service businesses that will eventually combine collaborative email handling, company context, and AI-assisted drafting.

This repository intentionally contains no product schema or user-facing feature implementation. The team can make those decisions together during the hackathon without first undoing speculative code.

## Problem

## Solution

## Target Users

## Demo

## Architecture

## Convex usage

## Context.dev usage

## Devin usage

## Pre-existing assets

## Ready now

- Bun workspace and lockfile
- TanStack Start, React 19, TypeScript, Tailwind CSS, and Turborepo
- Savari Convex project and development deployment
- Convex Auth v2 alpha component and signing keys
- Convex Agent and AI Gateway provider packages
- Official Context.dev Convex component
- Authenticated, schema-free Context.dev preview action with a mocked integration test
- Shared shadcn package with the complete stable component set
- Convex AI coding guidance and project skills
- Polished starter status screen
- Product scope, schedule, demo story, and architecture plan

## Intentionally left for the hackathon

- Product schema and indexes
- Auth provider and app-owned user model
- Dummy inbox data
- Shared inbox UI
- Assignment, labels, drafts, and collaboration behavior
- Context.dev enrichment UI and persistence
- AI Gateway prompting and draft action
- Gmail or Outlook integration

## Run locally

```bash
bun install
bun run dev
```

Open [http://localhost:3001](http://localhost:3001).

The repository is already linked to the Savari `reply` Convex project. For a fresh clone or a different deployment, update `VITE_CONVEX_URL` in `apps/web/.env` and configure the backend from `packages/backend` with Bun.

## Context.dev key

The development deployment currently has an explicit placeholder so the component can mount. Replace it before running the Context.dev action against the live service:

```bash
cd packages/backend
bunx --bun convex env set CONTEXT_DEV_API_KEY your_context_dev_key
```

## Commands

```bash
bun run dev          # Start web and Convex development processes
bun run dev:web      # Start only TanStack Start
bun run dev:server   # Start only Convex
bun run build        # Build the workspace
bun run check-types  # Type-check web, backend, and shared UI
bun run test         # Run the starter test suite
```

## Project map

```text
apps/web/                    TanStack Start app and setup screen
packages/backend/convex/     Empty schema, health check, mounted components
packages/ui/                 Shared shadcn components and Reply design tokens
docs/hackathon-plan.md       Build plan, demo path, and scope guardrails
docs/context-dev.md          Seven approved Context APIs and smoke-test flow
```

Read [`docs/hackathon-plan.md`](docs/hackathon-plan.md) before starting feature work.

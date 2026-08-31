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

## Mailbox OAuth

Reply can import recent Gmail and Microsoft Outlook conversations into the current workspace with read-only OAuth access. Register this exact callback URL in both provider applications:

```text
https://<your-convex-deployment>.convex.site/mail/oauth/callback
```

Enable the Gmail API and request `https://www.googleapis.com/auth/gmail.readonly` in Google Cloud. In Microsoft Entra, add delegated `User.Read` and `Mail.Read` permissions; the app also requests `offline_access` for refresh tokens.

Configure these values separately on every Convex deployment:

```bash
cd packages/backend
bunx --bun convex env set MAIL_GOOGLE_CLIENT_ID your-google-client-id
bunx --bun convex env set MAIL_GOOGLE_CLIENT_SECRET your-google-client-secret
bunx --bun convex env set MAIL_GOOGLE_PUBSUB_TOPIC projects/your-project/topics/reply-gmail
bunx --bun convex env set MAIL_GOOGLE_PUBSUB_SERVICE_ACCOUNT reply-gmail-push@your-project.iam.gserviceaccount.com
bunx --bun convex env set MAIL_MICROSOFT_CLIENT_ID your-microsoft-client-id
bunx --bun convex env set MAIL_MICROSOFT_CLIENT_SECRET your-microsoft-client-secret
bunx --bun convex env set MAIL_TOKEN_ENCRYPTION_KEY your-base64-encoded-32-byte-key
```

Generate the encryption key once with `openssl rand -base64 32`, store it securely, and never commit it. Losing or rotating this key disconnects existing channels. Open **Settings → Inboxes**, choose the destination inbox, and select **Connect channel** to authorize Gmail or Outlook. Imported conversations remain after disconnecting.

For guided Gmail Pub/Sub setup, run `./scripts/setup-gmail-push.sh`. The wizard opens each Google Cloud screen, validates the values, and can write the non-secret identifiers to the selected Convex deployment.

For Gmail live sync, create the Pub/Sub topic in the same Google Cloud project as the OAuth client, grant `gmail-api-push@system.gserviceaccount.com` the Pub/Sub Publisher role on the topic, and create an authenticated push subscription targeting:

```text
https://<your-convex-deployment>.convex.site/mail/webhooks/gmail
```

Configure the push subscription to issue an OIDC token from `MAIL_GOOGLE_PUBSUB_SERVICE_ACCOUNT`, with the endpoint URL above as its audience. The Pub/Sub service agent needs `roles/iam.serviceAccountTokenCreator` for that service account. Reply verifies the Google-signed token, renews Gmail watches before expiry, and performs a 15-minute fallback sync when push delivery is delayed or dropped.

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

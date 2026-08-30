# Context.dev boundary for Reply

Reply uses the official `@context-dot-dev/convex` component. Keep the API key in the Convex deployment, call Context.dev only from authenticated actions, and do not persist responses until the product schema is agreed.

## Approved APIs

| Helper | Use in Reply | Request shape |
| --- | --- | --- |
| `retrieveBrand` | Turn an email sender's domain into a company profile | `params: { domain }` |
| `scrapeMarkdown` | Convert one known company page into clean text | `params: { url }` |
| `extract` | Extract a small, explicit JSON schema from a website | `body: { url, schema, maxPages }` |
| `search` | Find relevant public pages when the URL is unknown | `body: { query, includeDomains? }` |
| `crawl` | Collect Markdown from a tightly bounded set of pages | `body: { url, maxPages, maxDepth? }` |
| `styleguide` | Retrieve colors, typography, spacing, and component CSS | `params: { domain }` or `params: { directUrl }` |
| `screenshot` | Capture a hosted website preview | `params: { domain }` or `params: { directUrl }` |

Use the narrowest helper that answers the question. In particular, prefer `retrieveBrand` for sender enrichment and `scrapeMarkdown` for one known page. Keep `crawl.maxPages` small because crawling is billed per page.

## Prepared action

`contextPreview:retrieveCompany` is the tested starter flow. It:

1. Requires a Convex identity before consuming Context.dev credits.
2. Accepts a bare domain such as `stripe.com`.
3. Calls `retrieveBrand` through the mounted Context.dev component.
4. Returns only `domain`, `name`, `description`, `logoUrl`, and `primaryColor`.
5. Stores nothing and leaves `schema.ts` empty.

The logo selection prefers a light-mode horizontal logo, then another horizontal logo, then an icon. Every optional Context.dev field is normalized to `null`.

## Live smoke test

After setting a real `CONTEXT_DEV_API_KEY` and starting the normal Convex development process, run:

```bash
cd packages/backend
bunx --bun convex run contextPreview:retrieveCompany '{"domain":"stripe.com"}' --identity '{"subject":"context-smoke-test","issuer":"https://convex.test","tokenIdentifier":"https://convex.test|context-smoke-test"}'
```

The expected result has `domain: "stripe.com"` and non-empty `name`, `description`, and `logoUrl` fields. Do not run this smoke test with the placeholder key.

## Guardrails

- Never expose `CONTEXT_DEV_API_KEY` to the browser.
- Authenticate before every API call that consumes credits.
- Treat missing brand fields as normal and show UI fallbacks.
- Check search result `markdown.code` before reading its Markdown.
- Pass exactly one of `domain` or `directUrl` to `styleguide` and `screenshot`.
- Avoid broad crawling during the hackathon demo.

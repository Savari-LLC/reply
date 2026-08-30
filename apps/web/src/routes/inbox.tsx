import { createFileRoute } from "@tanstack/react-router";

import { FIXTURE_SCENARIOS, type FixtureScenario } from "@/features/inbox/constants";
import { FixtureInboxPage } from "@/features/inbox/fixture-inbox-page";

export const Route = createFileRoute("/inbox")({
  validateSearch: (search: Record<string, unknown>): { scenario?: FixtureScenario } => {
    const raw = search.scenario;
    if (
      import.meta.env.DEV &&
      typeof raw === "string" &&
      (FIXTURE_SCENARIOS as readonly string[]).includes(raw)
    ) {
      return { scenario: raw as FixtureScenario };
    }
    return {};
  },
  component: InboxRoute,
});

function InboxRoute() {
  const { scenario } = Route.useSearch();
  return <FixtureInboxPage scenario={scenario} />;
}

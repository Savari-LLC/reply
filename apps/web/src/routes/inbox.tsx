import { Button } from "@reply/ui/components/button";
import { Spinner } from "@reply/ui/components/spinner";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { TriangleAlert } from "lucide-react";

import { AuthPanel } from "@/components/auth-panel";
import { FIXTURE_SCENARIOS, type FixtureScenario } from "@/features/inbox/constants";
import { ConvexInboxPage } from "@/features/inbox/convex-inbox-page";
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
  errorComponent: InboxError,
});

function InboxRoute() {
  const { scenario } = Route.useSearch();
  // Dev-only escape hatch: `?scenario=` renders the fixture-driven states
  // for design review without touching live data.
  if (import.meta.env.DEV && scenario) {
    return <FixtureInboxPage scenario={scenario} />;
  }
  return <AuthenticatedInbox />;
}

function AuthenticatedInbox() {
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (isLoading) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#eef0ec]" aria-live="polite">
        <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-[#fbfbf8] px-5 py-4 text-sm font-medium text-[#202d2a] shadow-lg shadow-[#202d2a]/5">
          <Spinner />
          Restoring your session…
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <AuthPanel />;
  }

  return <ConvexInboxPage />;
}

function InboxError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
      <TriangleAlert className="size-8 text-destructive" aria-hidden />
      <h1 className="text-lg font-semibold">The inbox could not load</h1>
      <p className="max-w-md text-sm text-muted-foreground">{error.message}</p>
      <Button
        variant="outline"
        onClick={() => {
          reset();
          void router.invalidate();
        }}
      >
        Try again
      </Button>
    </main>
  );
}

import { api } from "@reply/backend/convex/_generated/api";
import { Button } from "@reply/ui/components/button";
import { Spinner } from "@reply/ui/components/spinner";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useConvexAuth, useQuery } from "convex/react";
import { TriangleAlert } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";

import { AuthPanel } from "@/components/auth-panel";
import { AcceptInvitationPage, CreateWorkspacePage, InviteMembersPage } from "@/components/workspace-onboarding";
import { FIXTURE_SCENARIOS, type FixtureScenario } from "@/features/inbox/constants";
import { ConvexInboxPage } from "@/features/inbox/convex-inbox-page";
import { FixtureInboxPage } from "@/features/inbox/fixture-inbox-page";

type InboxSearchParams = { scenario?: FixtureScenario; invite?: string };

export const Route = createFileRoute("/inbox")({
  validateSearch: (search: Record<string, unknown>): InboxSearchParams => {
    const scenario = search.scenario;
    return {
      scenario:
        import.meta.env.DEV &&
        typeof scenario === "string" &&
        (FIXTURE_SCENARIOS as readonly string[]).includes(scenario)
          ? (scenario as FixtureScenario)
          : undefined,
      invite: typeof search.invite === "string" ? search.invite : undefined,
    };
  },
  component: InboxRoute,
  errorComponent: InboxError,
});

function InboxRoute() {
  const { scenario, invite } = Route.useSearch();
  // Dev-only escape hatch: `?scenario=` renders the fixture-driven states
  // for design review without touching live data.
  if (import.meta.env.DEV && scenario) {
    return <FixtureInboxPage scenario={scenario} />;
  }
  return <AuthenticatedInbox invite={invite} />;
}

function AuthenticatedInbox({ invite }: { invite?: string }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const navigate = Route.useNavigate();
  const currentWorkspace = useQuery(api.workspaces.getCurrent, isAuthenticated ? {} : "skip");
  const clearInvitation = useCallback(() => {
    void navigate({ search: {}, replace: true });
  }, [navigate]);
  const acceptInvitation = useCallback(
    (workspaceName: string) => {
      toast.success(`Joined ${workspaceName}`);
      clearInvitation();
    },
    [clearInvitation],
  );

  if (isLoading) {
    return <RouteLoading label="Restoring your session…" />;
  }
  if (!isAuthenticated) {
    return <AuthPanel invited={invite !== undefined} />;
  }
  if (invite !== undefined) {
    return <AcceptInvitationPage token={invite} onAccepted={acceptInvitation} onDismiss={clearInvitation} />;
  }
  if (currentWorkspace === undefined) {
    return <RouteLoading label="Loading your workspace…" />;
  }
  if (currentWorkspace === null) {
    return <CreateWorkspacePage />;
  }
  if (
    currentWorkspace.membership.role === "admin" &&
    currentWorkspace.workspace.onboardingCompletedAt === undefined
  ) {
    return (
      <InviteMembersPage
        workspaceName={currentWorkspace.workspace.name}
        memberCount={currentWorkspace.memberCount}
      />
    );
  }
  return <ConvexInboxPage />;
}

function RouteLoading({ label }: { label: string }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-[#eef0ec]" aria-live="polite">
      <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-[#fbfbf8] px-5 py-4 text-sm font-medium text-[#202d2a] shadow-lg shadow-[#202d2a]/5">
        <Spinner />
        {label}
      </div>
    </main>
  );
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

import { Spinner } from "@reply/ui/components/spinner";
import { Navigate, createFileRoute } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";

import { AuthPanel } from "@/components/auth-panel";

type AuthSearchParams = { invite?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearchParams => ({
    invite: typeof search.invite === "string" ? search.invite : undefined,
  }),
  component: AuthRoute,
});

function AuthRoute() {
  const { invite } = Route.useSearch();
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
  if (isAuthenticated) {
    return <Navigate to="/inbox" search={invite ? { invite } : {}} replace />;
  }
  return <AuthPanel invited={invite !== undefined} />;
}

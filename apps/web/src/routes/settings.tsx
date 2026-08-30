import { api } from "@reply/backend/convex/_generated/api";
import { Button } from "@reply/ui/components/button";
import { Spinner } from "@reply/ui/components/spinner";
import { createFileRoute, Navigate, useRouter } from "@tanstack/react-router";
import { useConvexAuth, useQuery } from "convex/react";
import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { SETTINGS_SECTIONS, type SettingsSection } from "@/features/settings/constants";
import { SettingsScreen } from "@/features/settings/settings-screen";

type SettingsSearchParams = {
  section?: SettingsSection;
  mail?: "connected" | "error";
  mailMessage?: string;
};

export const Route = createFileRoute("/settings")({
  validateSearch: (search: Record<string, unknown>): SettingsSearchParams => {
    const section = search.section;
    return {
      section:
        typeof section === "string" &&
        (SETTINGS_SECTIONS as readonly string[]).includes(section)
          ? (section as SettingsSection)
          : undefined,
      mail:
        search.mail === "connected" || search.mail === "error" ? search.mail : undefined,
      mailMessage:
        typeof search.mailMessage === "string" ? search.mailMessage : undefined,
    };
  },
  component: SettingsRoute,
  errorComponent: SettingsError,
});

function SettingsRoute() {
  const { section, mail, mailMessage } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const currentWorkspace = useQuery(api.workspaces.getCurrent, isAuthenticated ? {} : "skip");

  useEffect(() => {
    if (!mail) return;
    if (mail === "connected") {
      toast.success("Mailbox connected", {
        description: "The first read-only import has started.",
      });
    } else {
      toast.error("Mailbox connection failed", {
        description: mailMessage ?? "Try connecting the mailbox again.",
      });
    }
    void navigate({ search: { section: section ?? "inboxes" }, replace: true });
  }, [mail, mailMessage, navigate, section]);

  if (isLoading || (isAuthenticated && currentWorkspace === undefined)) {
    return <RouteLoading label="Loading settings…" />;
  }
  // Sign-in and workspace onboarding both live on the inbox route.
  if (!isAuthenticated || currentWorkspace === null) {
    return <Navigate to="/inbox" search={{}} />;
  }
  return (
    <SettingsScreen
      section={section ?? "members"}
      onSectionChange={(next) => void navigate({ search: { section: next } })}
      workspace={currentWorkspace!.workspace}
      membership={currentWorkspace!.membership}
    />
  );
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

function SettingsError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
      <TriangleAlert className="size-8 text-destructive" aria-hidden />
      <h1 className="text-lg font-semibold">Settings could not load</h1>
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

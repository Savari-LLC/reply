import { Spinner } from "@reply/ui/components/spinner";
import {
  ArrowUpRight,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  FlaskConical,
  SearchCheck,
  Sparkles,
} from "lucide-react";
import type { ComponentType } from "react";

import { INVESTIGATION_STATE_COPY } from "../constants";
import type { Investigation, InvestigationErrorCode, OperationState } from "../types";

const STATE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  queued: Sparkles,
  investigating: Sparkles,
  issue_found: SearchCheck,
  fixing: SearchCheck,
  testing: FlaskConical,
  creating_pr: ArrowUpRight,
  completed: CircleCheck,
};

const ERROR_COPY: Record<InvestigationErrorCode, { title: string; action: string }> = {
  not_configured: { title: "Investigation couldn't be started", action: "Retry" },
  no_repository: {
    title: "Connect your software repository to investigate technical issues.",
    action: "Connect Repository",
  },
  start_failed: { title: "Investigation couldn't be started", action: "Retry" },
  investigation_failed: {
    title: "Devin couldn't complete this investigation.",
    action: "Retry Investigation",
  },
};

const ACTIVE_STATUSES = new Set(["queued", "investigating", "issue_found", "fixing", "testing", "creating_pr"]);

type InvestigationCardProps = {
  investigation: Investigation;
  /** Opens the investigation sheet with the friendly timeline. */
  onOpen: () => void;
  investigationState: OperationState;
};

/**
 * Inline Devin state inside the email thread. One calm row: icon, plain
 * business copy, and a chevron into the investigation sheet. Progress updates
 * arrive live through the Convex subscription.
 */
export function InvestigationCard({
  investigation,
  onOpen,
  investigationState,
}: InvestigationCardProps) {
  const failed = investigation.status === "failed";
  const error = investigation.error;
  const active = ACTIVE_STATUSES.has(investigation.status);
  const Icon = failed ? CircleAlert : (STATE_ICONS[investigation.status] ?? Sparkles);
  const copy =
    investigation.status === "failed"
      ? {
          title: error ? ERROR_COPY[error.code].title : "Investigation couldn't be started",
          detail: "Open for details",
        }
      : INVESTIGATION_STATE_COPY[investigation.status];

  const detail =
    !failed && investigation.status === "completed"
      ? investigation.noIssueFound
        ? "No clear software issue was found."
        : [
            investigation.testsPassed ? "Tests passed" : null,
            investigation.pullRequestNumber ? `PR #${investigation.pullRequestNumber}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || copy.detail
      : copy.detail;

  const busy = investigationState.status === "loading";

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={busy}
      aria-label={`Devin investigation: ${copy.title}. Open details`}
      className={`group flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--inbox-primary) disabled:opacity-60 ${
        failed
          ? "border-destructive/20 bg-destructive/5 hover:bg-destructive/10"
          : "border-(--inbox-border) bg-(--inbox-surface-elevated) hover:bg-(--inbox-hover)"
      }`}
    >
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
          failed
            ? "bg-destructive/10 text-destructive"
            : investigation.status === "completed"
              ? "bg-(--inbox-success)/15 text-(--inbox-primary-text)"
              : "bg-(--inbox-primary)/10 text-(--inbox-primary-text)"
        } ${active ? "inbox-investigation-pulse" : ""}`}
        aria-hidden
      >
        {busy ? <Spinner className="size-4" /> : <Icon className="size-4.5" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={`truncate text-sm font-semibold tracking-[-0.1px] ${
            failed ? "text-destructive" : "text-(--inbox-text-strong)"
          }`}
        >
          {copy.title}
        </span>
        <span className="truncate text-xs leading-4 text-(--inbox-text-muted)">
          {active ? <span className="inbox-investigation-ellipsis">{detail}</span> : detail}
        </span>
      </span>
      {failed && error ? (
        <span className="shrink-0 rounded-lg border border-(--inbox-border) bg-(--inbox-surface-elevated) px-2.5 py-1.5 text-xs font-medium text-(--inbox-text) transition-colors group-hover:bg-(--inbox-hover)">
          {ERROR_COPY[error.code].action}
        </span>
      ) : null}
      <ChevronRight
        className="size-4 shrink-0 text-(--inbox-text-muted) transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </button>
  );
}

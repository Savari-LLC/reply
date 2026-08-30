import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@reply/ui/components/dialog";
import { Spinner } from "@reply/ui/components/spinner";
import { Check, CircleAlert, CircleCheck, ExternalLink, Reply, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";

import type { Investigation, InvestigationStatus, OperationState } from "../types";

const PRIMARY_BUTTON =
  "flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-(--inbox-primary) px-3 text-sm font-medium tracking-[-0.1px] text-(--inbox-text-inverse) outline-none transition-colors hover:bg-(--inbox-primary)/90 focus-visible:ring-2 focus-visible:ring-(--inbox-primary) focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60";

const SECONDARY_BUTTON =
  "flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-(--inbox-border) bg-(--inbox-surface-elevated) px-3 text-sm font-medium tracking-[-0.1px] text-(--inbox-text) outline-none transition-colors hover:bg-(--inbox-hover) focus-visible:ring-2 focus-visible:ring-(--inbox-primary) disabled:pointer-events-none disabled:opacity-60";

/** User-friendly timeline; each step maps onto investigation statuses. */
const STEPS: { label: string; reachedAt: InvestigationStatus[] }[] = [
  { label: "Understanding the reported issue", reachedAt: ["investigating"] },
  { label: "Checking the affected software", reachedAt: ["investigating"] },
  { label: "Trying to reproduce the problem", reachedAt: ["issue_found"] },
  { label: "Preparing a possible fix", reachedAt: ["fixing"] },
  { label: "Testing the fix", reachedAt: ["testing"] },
  { label: "Creating a pull request", reachedAt: ["creating_pr"] },
];

const STATUS_ORDER: InvestigationStatus[] = [
  "queued",
  "investigating",
  "issue_found",
  "fixing",
  "testing",
  "creating_pr",
  "completed",
];

/** Index of the active timeline step for an in-progress status. */
function activeStepIndex(status: InvestigationStatus): number {
  switch (status) {
    case "queued":
      return 0;
    case "investigating":
      return 1;
    case "issue_found":
    case "fixing":
      // Reproduction succeeded once the issue is found; a fix is next.
      return 3;
    case "testing":
      return 4;
    case "creating_pr":
      return 5;
    default:
      return STEPS.length;
  }
}

function Timeline({ status }: { status: InvestigationStatus }) {
  const active = activeStepIndex(status);
  const done = status === "completed" ? STEPS.length : active;
  return (
    <ol className="flex flex-col gap-2.5" aria-label="Investigation progress">
      {STEPS.map((step, index) => {
        const state = index < done ? "done" : index === active ? "active" : "pending";
        return (
          <li key={step.label} className="flex items-center gap-2.5">
            {state === "done" ? (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-(--inbox-success)/15">
                <Check className="size-3 text-(--inbox-primary-text)" aria-hidden />
              </span>
            ) : state === "active" ? (
              <span
                className="inbox-investigation-pulse flex size-5 shrink-0 items-center justify-center rounded-full bg-(--inbox-primary)/15"
                aria-hidden
              >
                <span className="size-2 rounded-full bg-(--inbox-primary)" />
              </span>
            ) : (
              <span
                className="flex size-5 shrink-0 items-center justify-center rounded-full border border-(--inbox-border-strong)"
                aria-hidden
              />
            )}
            <span
              className={`text-sm tracking-[-0.1px] ${
                state === "pending"
                  ? "text-(--inbox-text-muted)"
                  : state === "active"
                    ? "font-medium text-(--inbox-text-strong)"
                    : "text-(--inbox-text)"
              }`}
            >
              {step.label}
              {state === "active" ? <span className="sr-only"> (in progress)</span> : null}
              {state === "done" ? <span className="sr-only"> (done)</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Finding({ label, body }: { label: string; body: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold tracking-[-0.1px] text-(--inbox-text-strong)">{label}</p>
      <p className="text-sm leading-5 text-(--inbox-text)">{body}</p>
    </div>
  );
}

type InvestigationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investigation: Investigation;
  investigationState: OperationState;
  onRetry: () => void;
  onConnectRepository: (repoUrl: string) => Promise<void>;
  /** Closes the sheet and opens the reply composer. */
  onReplyToCustomer: () => void;
};

/**
 * Investigation sheet for business owners: a friendly timeline while Devin
 * works, findings in plain language when the issue is found, and a fix-ready
 * summary with the pull request when done. Never shows logs or agent output.
 */
export function InvestigationModal({
  open,
  onOpenChange,
  investigation,
  investigationState,
  onRetry,
  onConnectRepository,
  onReplyToCustomer,
}: InvestigationModalProps) {
  const busy = investigationState.status === "loading";
  const running =
    STATUS_ORDER.includes(investigation.status) && investigation.status !== "completed";
  const failed = investigation.status === "failed";
  const completed = investigation.status === "completed";
  const showFindings =
    !failed &&
    !completed &&
    (investigation.summary !== undefined || investigation.impact !== undefined) &&
    activeStepIndex(investigation.status) >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] gap-0 rounded-2xl border-none bg-(--inbox-surface-elevated) p-0 shadow-xl ring-1 ring-(--inbox-border) sm:max-w-md">
        <div className="flex flex-col gap-4 p-5">
          {/* Header */}
          <div className="flex items-start gap-3">
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                failed
                  ? "bg-destructive/10 text-destructive"
                  : completed
                    ? "bg-(--inbox-success)/15 text-(--inbox-primary-text)"
                    : "inbox-investigation-pulse bg-(--inbox-primary)/10 text-(--inbox-primary-text)"
              }`}
              aria-hidden
            >
              {failed ? (
                <CircleAlert className="size-5" />
              ) : completed ? (
                <CircleCheck className="size-5" />
              ) : (
                <Sparkles className="size-5" />
              )}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <DialogTitle className="text-base font-semibold tracking-[-0.1px] text-(--inbox-text-strong)">
                {failed
                  ? "Investigation needs attention"
                  : completed
                    ? investigation.noIssueFound
                      ? "No issue found"
                      : "Fix Ready"
                    : investigation.summary
                      ? "Issue Found"
                      : "Devin is investigating"}
              </DialogTitle>
              <DialogDescription className="text-sm leading-5 text-(--inbox-text-muted)">
                {failed
                  ? (investigation.error?.message ?? "Something went wrong.")
                  : completed
                    ? investigation.noIssueFound
                      ? "No clear software issue was found."
                      : "A fix is ready for your review — nothing has been merged or deployed."
                    : "Devin is checking your software. This updates live."}
              </DialogDescription>
            </div>
          </div>

          {/* Timeline while running */}
          {running ? (
            <div className="rounded-xl bg-(--inbox-surface) p-4">
              <Timeline status={investigation.status} />
            </div>
          ) : null}

          {/* Findings in plain business language */}
          {showFindings ? (
            <div className="flex flex-col gap-3 rounded-xl border border-(--inbox-border-subtle) p-4">
              {investigation.summary ? (
                <Finding label="What happened" body={investigation.summary} />
              ) : null}
              {investigation.impact ? (
                <Finding label="Impact" body={investigation.impact} />
              ) : null}
              <Finding
                label="What Devin is doing"
                body="A fix is being prepared and tested. You'll see the result here."
              />
            </div>
          ) : null}

          {/* Completed */}
          {completed ? (
            <div className="flex flex-col gap-3 rounded-xl border border-(--inbox-border-subtle) p-4">
              {investigation.noIssueFound ? (
                <Finding
                  label="What Devin found"
                  body={
                    investigation.summary ??
                    "Devin checked the reported behavior but couldn't reproduce a software problem. It may be a one-off or something outside the software."
                  }
                />
              ) : (
                <>
                  {investigation.rootCause ?? investigation.summary ? (
                    <Finding
                      label="What went wrong"
                      body={(investigation.rootCause ?? investigation.summary)!}
                    />
                  ) : null}
                  {investigation.fixSummary ? (
                    <Finding label="What Devin changed" body={investigation.fixSummary} />
                  ) : null}
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold tracking-[-0.1px] text-(--inbox-text-strong)">
                      Verification
                    </p>
                    <p className="flex items-center gap-1.5 text-sm text-(--inbox-text)">
                      {investigation.testsPassed ? (
                        <>
                          <Check className="size-4 text-(--inbox-primary-text)" aria-hidden />
                          Tests passed
                        </>
                      ) : (
                        "Tests are still being confirmed."
                      )}
                    </p>
                  </div>
                  {investigation.pullRequestUrl ? (
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-semibold tracking-[-0.1px] text-(--inbox-text-strong)">
                        Pull Request
                      </p>
                      <a
                        href={investigation.pullRequestUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex w-fit items-center gap-1 rounded-sm text-sm font-medium text-(--inbox-primary-text) outline-none hover:underline focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
                      >
                        {investigation.pullRequestNumber
                          ? `PR #${investigation.pullRequestNumber}`
                          : "View pull request"}
                        {investigation.fixSummary ? ` – ${truncate(investigation.fixSummary, 48)}` : ""}
                        <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                      </a>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {/* Failure recovery */}
          {failed ? (
            investigation.error?.code === "no_repository" ? (
              <ConnectRepositoryForm busy={busy} onConnect={onConnectRepository} />
            ) : (
              <button type="button" className={`${PRIMARY_BUTTON} w-fit`} onClick={onRetry} disabled={busy}>
                {busy ? <Spinner className="size-3.5" /> : null}
                {investigation.error?.code === "investigation_failed"
                  ? "Retry Investigation"
                  : "Retry"}
              </button>
            )
          ) : null}

          {/* Completed actions */}
          {completed ? (
            <div className="flex flex-wrap items-center gap-2">
              {investigation.pullRequestUrl && !investigation.noIssueFound ? (
                <a
                  href={investigation.pullRequestUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={PRIMARY_BUTTON}
                >
                  View Pull Request
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : null}
              <button type="button" className={SECONDARY_BUTTON} onClick={onReplyToCustomer}>
                <Reply className="size-3.5" aria-hidden />
                Reply to Customer
              </button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Inline form for the "no repository connected" recovery path. */
function ConnectRepositoryForm({
  busy,
  onConnect,
}: {
  busy: boolean;
  onConnect: (repoUrl: string) => Promise<void>;
}) {
  const [repoUrl, setRepoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (repoUrl.trim().length === 0 || submitting) return;
    setSubmitting(true);
    try {
      await onConnect(repoUrl);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-2">
      <label
        htmlFor="investigation-repo-url"
        className="text-xs font-medium text-(--inbox-text-subtle)"
      >
        Repository URL
      </label>
      <div className="flex items-center gap-2">
        <input
          id="investigation-repo-url"
          type="url"
          required
          value={repoUrl}
          onChange={(event) => setRepoUrl(event.target.value)}
          placeholder="https://github.com/your-org/your-app"
          className="h-8 min-w-0 flex-1 rounded-lg border border-(--inbox-border) bg-(--inbox-surface-elevated) px-2.5 text-sm text-(--inbox-text-strong) outline-none placeholder:text-(--inbox-text-muted) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
        />
        <button
          type="submit"
          className={PRIMARY_BUTTON}
          disabled={busy || submitting || repoUrl.trim().length === 0}
        >
          {busy || submitting ? <Spinner className="size-3.5" /> : null}
          Connect Repository
        </button>
      </div>
    </form>
  );
}

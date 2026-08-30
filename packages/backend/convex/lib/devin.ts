/**
 * Pure helpers for the Devin session integration: prompt/schema construction
 * and mapping Devin's polled session state onto investigation progress.
 * Kept free of Convex imports so the mapping is unit-testable.
 */

/** Stages Devin is instructed to report through structured output. */
export type DevinStage =
  | "understanding"
  | "reproducing"
  | "issue_found"
  | "fixing"
  | "testing"
  | "creating_pr"
  | "completed"
  | "no_issue_found";

export type InvestigationStatus =
  | "queued"
  | "investigating"
  | "issue_found"
  | "fixing"
  | "testing"
  | "creating_pr"
  | "completed"
  | "failed";

const STAGE_TO_STATUS: Record<DevinStage, InvestigationStatus> = {
  understanding: "investigating",
  reproducing: "investigating",
  issue_found: "issue_found",
  fixing: "fixing",
  testing: "testing",
  creating_pr: "creating_pr",
  completed: "completed",
  no_issue_found: "completed",
};

const DEVIN_STAGES = Object.keys(STAGE_TO_STATUS) as DevinStage[];

/** JSON Schema (draft 7) Devin keeps updated for the whole session. */
export const STRUCTURED_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    stage: {
      type: "string",
      enum: DEVIN_STAGES,
      description: "Current phase of the investigation.",
    },
    customer_summary: {
      type: "string",
      description:
        "What happened, in 1-2 sentences of plain business language for a non-technical business owner.",
    },
    impact: {
      type: "string",
      description: "Which customers or actions are affected, in plain business language.",
    },
    root_cause: {
      type: "string",
      description: "The root cause, explained simply without code or stack traces.",
    },
    fix_summary: {
      type: "string",
      description: "What the fix changes, explained simply.",
    },
    tests_passed: { type: "boolean" },
    pull_request_url: { type: "string" },
    pull_request_number: { type: "integer" },
  },
  required: ["stage"],
} as const;

export function buildInvestigationPrompt(input: {
  repoUrl: string;
  workspaceName: string;
  subject: string;
  senderName: string;
  senderEmail: string;
  emailBody: string;
}): string {
  return [
    `A customer of ${input.workspaceName} reported a technical problem by email. Investigate it in the repository ${input.repoUrl}.`,
    "",
    `Reported by: ${input.senderName} <${input.senderEmail}>`,
    `Subject: ${input.subject}`,
    "Email:",
    input.emailBody,
    "",
    "Your job:",
    "1. Understand the reported issue and locate the affected code.",
    "2. Try to reproduce the problem.",
    "3. Identify the root cause.",
    "4. Prepare a fix on a new branch.",
    "5. Run the relevant tests.",
    "6. Open a pull request with the fix. NEVER merge or deploy it.",
    "",
    "Keep the structured output updated at every stage transition using the provided schema:",
    "- Set `stage` as you move through understanding → reproducing → issue_found → fixing → testing → creating_pr → completed.",
    "- If you cannot find a reproducible software issue, set `stage` to no_issue_found and explain in customer_summary.",
    "- Fill customer_summary, impact, root_cause, and fix_summary in plain business language for a non-technical business owner: no code, file names, stack traces, or git terminology.",
    "- Set tests_passed after running tests, and pull_request_url / pull_request_number after opening the PR.",
    "- Set stage to completed once the pull request is open.",
    "- If you cannot push or open a pull request (for example, missing repository write access), do NOT stall: still set stage to completed once the fix is verified, and note in fix_summary that the change is ready to publish.",
  ].join("\n");
}

/** Fields the poller may learn from one Devin session snapshot. */
export type DevinProgress = {
  status?: InvestigationStatus;
  currentStage?: string;
  customerFriendlySummary?: string;
  impact?: string;
  rootCause?: string;
  fixSummary?: string;
  testsPassed?: boolean;
  pullRequestUrl?: string;
  pullRequestNumber?: number;
  noIssueFound?: boolean;
  completedAt?: number;
  /** Terminal outcome of this snapshot, if any. */
  outcome: "running" | "completed" | "failed";
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function parsePullRequestNumber(url: string | undefined): number | undefined {
  const match = url?.match(/\/(?:pull|merge_requests)\/(\d+)/);
  return match ? Number(match[1]) : undefined;
}

/**
 * Map one polled Devin session response onto investigation progress.
 * `structured_output` is authoritative for stage and findings; `status_enum`
 * decides liveness (expired sessions fail, finished sessions finalize).
 */
export function mapDevinSession(session: {
  status_enum?: string | null;
  structured_output?: unknown;
  pull_request?: { url?: string } | null;
}): DevinProgress {
  const output =
    typeof session.structured_output === "object" && session.structured_output !== null
      ? (session.structured_output as Record<string, unknown>)
      : {};

  const stage = DEVIN_STAGES.find((candidate) => candidate === output.stage);
  const pullRequestUrl =
    asString(output.pull_request_url) ?? asString(session.pull_request?.url ?? undefined);
  const pullRequestNumber =
    typeof output.pull_request_number === "number"
      ? output.pull_request_number
      : parsePullRequestNumber(pullRequestUrl);

  const progress: DevinProgress = {
    currentStage: stage,
    customerFriendlySummary: asString(output.customer_summary),
    impact: asString(output.impact),
    rootCause: asString(output.root_cause),
    fixSummary: asString(output.fix_summary),
    testsPassed: typeof output.tests_passed === "boolean" ? output.tests_passed : undefined,
    pullRequestUrl,
    pullRequestNumber,
    outcome: "running",
  };

  if (session.status_enum === "expired") {
    progress.outcome = "failed";
    return progress;
  }

  const stageDone = stage === "completed" || stage === "no_issue_found";
  const sessionDone = session.status_enum === "finished";
  // Devin parks in "blocked" when it is done and awaiting a human; treat it
  // as terminal once it has produced a PR, a definitive stage, or verified
  // findings (root cause + fix) it cannot publish, e.g. without repo access.
  const definitiveFindings =
    progress.rootCause !== undefined && progress.fixSummary !== undefined;
  const blockedButDone =
    session.status_enum === "blocked" &&
    (stageDone || pullRequestUrl !== undefined || definitiveFindings);

  if (stageDone || sessionDone || blockedButDone) {
    progress.outcome = "completed";
    progress.status = "completed";
    progress.noIssueFound = stage === "no_issue_found" ? true : undefined;
    progress.completedAt = Date.now();
    return progress;
  }

  if (stage) progress.status = STAGE_TO_STATUS[stage];
  return progress;
}

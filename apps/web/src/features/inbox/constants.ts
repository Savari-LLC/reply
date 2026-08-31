import type {
  EmailCategory,
  InvestigationStatus,
  InboxView,
  LabelAccent,
  OperationKey,
  OperationState,
  ThreadStatus,
} from "./types";

/** Thread-list filter tabs. "open" covers open + waiting; "closed" shows Done. */
export const THREAD_FILTERS = ["open", "closed"] as const;
export type ThreadFilter = (typeof THREAD_FILTERS)[number];

/** Backend `closed` is always displayed as "Done". */
export const STATUS_LABELS: Record<ThreadStatus, string> = {
  open: "Open",
  waiting: "Waiting",
  closed: "Done",
};

export const FILTER_LABELS: Record<ThreadFilter, string> = {
  open: "Open",
  closed: "Done",
};

/** Sidebar view labels; "all" is unused by the sidebar but kept for the model. */
export const INBOX_VIEW_LABELS: Record<Exclude<InboxView, "all">, string> = {
  open: "Open",
  assigned: "Assigned",
  done: "Done",
  mentions: "Mentions",
  sent: "Sent",
};

/** Decorative category accents from the Figma palette. Always paired with a text label. */
export const LABEL_ACCENT_STYLES: Record<LabelAccent, { dot: string; bg: string; text: string }> = {
  magenta: { dot: "#ff34a7", bg: "#ffd6e9", text: "#960d68" },
  purple: { dot: "#822dd2", bg: "#f0d6ff", text: "#5b1e94" },
  amber: { dot: "#f75d0a", bg: "#ffe3d1", text: "#9a3a06" },
  yellow: { dot: "#fad805", bg: "#fdf3bc", text: "#6e5f02" },
  blue: { dot: "#0185ff", bg: "#d6ecff", text: "#0e43a0" },
};

/** Auto-triage categories: display copy plus a decorative accent. */
export const CATEGORY_META: Record<EmailCategory, { label: string; accent: LabelAccent }> = {
  quote_request: { label: "Quote Request", accent: "purple" },
  booking: { label: "Booking", accent: "yellow" },
  technical: { label: "Technical", accent: "blue" },
  billing: { label: "Billing", accent: "amber" },
  complaint: { label: "Complaint", accent: "magenta" },
  general: { label: "General", accent: "blue" },
};

/**
 * Below this confidence a technical email is flagged for review instead of
 * auto-starting Devin. Mirrors AUTO_INVESTIGATE_THRESHOLD on the backend.
 */
export const TECHNICAL_REVIEW_THRESHOLD = 0.85;

/** Inline copy for each investigation state shown inside the email thread. */
export const INVESTIGATION_STATE_COPY: Record<
  Exclude<InvestigationStatus, "failed">,
  { title: string; detail: string }
> = {
  queued: { title: "Devin is investigating", detail: "Checking your software..." },
  investigating: { title: "Devin is investigating", detail: "Checking your software..." },
  issue_found: { title: "Issue found", detail: "Preparing a fix..." },
  fixing: { title: "Issue found", detail: "Preparing a fix..." },
  testing: { title: "Testing the fix...", detail: "Making sure everything works" },
  creating_pr: { title: "Preparing pull request...", detail: "Packaging the fix for review" },
  completed: { title: "Fix ready", detail: "Tests passed" },
};

export const IDLE_OPERATION: OperationState = { status: "idle" };

export const OPERATION_KEYS: OperationKey[] = [
  "assign",
  "status",
  "unread",
  "priority",
  "labels",
  "draft",
  "send",
  "comment",
  "simulate",
  "investigation",
];

export const INITIAL_OPERATIONS = Object.fromEntries(
  OPERATION_KEYS.map((key) => [key, IDLE_OPERATION]),
) as Record<OperationKey, OperationState>;

/** Stable toast ids so repeated requests never stack duplicates. */
export const TOAST_IDS = {
  send: "inbox-send",
  comment: "inbox-comment",
  status: "inbox-status",
  assign: "inbox-assign",
  unread: "inbox-unread",
  priority: "inbox-priority",
  labels: "inbox-labels",
  simulate: "inbox-simulate",
  investigation: "inbox-investigation",
  workspace: "inbox-workspace",
} as const;

/** Deterministic fixture scenarios, selectable via `?scenario=` in development. */
export const FIXTURE_SCENARIOS = [
  "ready",
  "loading",
  "screen-error",
  "list-loading",
  "list-error",
  "empty-inbox",
  "empty-filter",
  "thread-loading",
  "thread-error",
  "mutation-error",
  "draft-error",
  "send-error",
  "missing-company",
] as const;
export type FixtureScenario = (typeof FIXTURE_SCENARIOS)[number];

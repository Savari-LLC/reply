/**
 * Frozen view model for the inbox feature.
 *
 * Everything here is plain data with string IDs. The fixture page (and later
 * the Convex adapter) converts source records into these shapes, so visual
 * components never see backend types.
 */

export type ThreadStatus = "open" | "waiting" | "closed";
export type ThreadPriority = "normal" | "urgent";
export type MessageDirection = "inbound" | "outbound";
export type AsyncStatus = "idle" | "loading" | "success" | "error";

export type OperationKey =
  | "assign"
  | "status"
  | "unread"
  | "priority"
  | "labels"
  | "draft"
  | "send"
  | "simulate";

export type OperationState = {
  status: AsyncStatus;
  message?: string;
};

export type LabelAccent = "magenta" | "purple" | "amber" | "yellow" | "blue";

export type ThreadLabel = {
  id: string;
  name: string;
  accent: LabelAccent;
};

export type InboxSummary = {
  id: string;
  name: string;
  slug: string;
  /** Personal inboxes belong to the signed-in user; shared ones to the team. */
  kind: "shared" | "personal";
  displayOrder: number;
  unreadCount: number;
  accent: LabelAccent;
  /** Whether any channel delivers into this inbox (drives empty-state hints). */
  hasChannel: boolean;
};

export type Teammate = {
  id: string;
  name: string;
  initials: string;
  avatarUrl?: string;
  role: string;
};

export type ThreadSummary = {
  id: string;
  inboxId: string;
  customerName: string;
  customerEmail: string;
  companyName?: string;
  /** Context.dev logo for the sender's company; replaces the initials avatar. */
  companyLogoUrl?: string;
  subject: string;
  preview: string;
  status: ThreadStatus;
  priority: ThreadPriority;
  assigneeId: string | null;
  labels: ThreadLabel[];
  unread: boolean;
  lastActivityAt: number;
};

export type Message = {
  id: string;
  threadId: string;
  direction: MessageDirection;
  authorName: string;
  authorEmail?: string;
  recipientEmail?: string;
  body: string;
  /** Optional rich-text rendering of `body` produced by the composer. */
  bodyHtml?: string;
  sentAt: number;
};

export type CompanyProfile = {
  name: string;
  domain: string;
  description?: string;
  logoUrl?: string;
  industry?: string;
  location?: string;
  slogan?: string;
  primaryColor?: string;
  website?: string;
  email?: string;
  phone?: string;
  socials?: { type: string; url: string }[];
};

/** Lifecycle of Context.dev enrichment for the selected thread's sender. */
export type CompanyStatus = "loading" | "ready" | "unavailable";

export type ThreadDetail = {
  thread: ThreadSummary;
  messages: Message[];
  /** `undefined` = enrichment unavailable; render domain/name fallbacks. */
  company?: CompanyProfile;
  /** Defaults to "ready"/"unavailable" based on `company` when omitted. */
  companyStatus?: CompanyStatus;
};

/** A teammate currently viewing the selected thread (live presence). */
export type ThreadViewer = {
  id: string;
  name: string;
  initials: string;
  imageUrl?: string;
  isSelf: boolean;
};

export type ScreenStatus = "loading" | "ready" | "error";
export type ListStatus = "idle" | "loading" | "ready" | "empty" | "error";
export type ThreadPaneStatus = "idle" | "loading" | "ready" | "error";

export type InboxScreenState = {
  screenStatus: ScreenStatus;
  screenError?: string;
  inboxes: InboxSummary[];
  teammates: Teammate[];
  selectedInboxId: string | null;
  selectedThreadId: string | null;
  listStatus: ListStatus;
  listError?: string;
  threads: ThreadSummary[];
  threadStatus: ThreadPaneStatus;
  threadError?: string;
  selectedThread: ThreadDetail | null;
  operations: Record<OperationKey, OperationState>;
};

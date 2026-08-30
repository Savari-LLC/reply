/**
 * Integration seam between the inbox UI and any data source.
 *
 * `fixture-inbox-page.tsx` implements this contract with seeded local data;
 * the integration developer later adds `convex-inbox-page.tsx` implementing
 * the same interface. Keep this module free of React, Convex, Sonner, and
 * fixture imports.
 */

import type {
  CommentDraft,
  CopilotMode,
  InboxScreenState,
  InboxView,
  ThreadPriority,
  ThreadStatus,
} from "./types";

export type LoadScope = "screen" | "list" | "thread";

export type InboxController = {
  state: InboxScreenState;
  /** Select an inbox, optionally scoped to a sidebar view (defaults to "open"). */
  selectInbox: (inboxId: string, view?: InboxView) => void;
  selectThread: (threadId: string) => void;
  assignThread: (threadId: string, teammateId: string) => Promise<void>;
  setStatus: (threadId: string, status: ThreadStatus) => Promise<void>;
  setPriority: (threadId: string, priority: ThreadPriority) => Promise<void>;
  setLabels: (threadId: string, labels: string[]) => Promise<void>;
  /**
   * Copilot writing assistance. `currentDraft` is the operator's in-progress
   * text; `mode` picks drafting from scratch, grammar fixes, or improving the
   * writing (defaults to "draft").
   */
  generateDraft: (threadId: string, currentDraft?: string, mode?: CopilotMode) => Promise<string>;
  sendReply: (threadId: string, body: string, bodyHtml?: string) => Promise<void>;
  /** Post an internal comment on the thread (never emailed to the customer). */
  addComment: (threadId: string, draft: CommentDraft) => Promise<void>;
  /** Demo: deliver a synthetic inbound email (real company domain) into an inbox. */
  simulateEmail: (inboxId: string) => Promise<void>;
  retryLoad: (scope: LoadScope) => Promise<void>;
};

export type * from "./types";

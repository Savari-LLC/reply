/**
 * Integration seam between the inbox UI and any data source.
 *
 * `fixture-inbox-page.tsx` implements this contract with seeded local data;
 * the integration developer later adds `convex-inbox-page.tsx` implementing
 * the same interface. Keep this module free of React, Convex, Sonner, and
 * fixture imports.
 */

import type { InboxScreenState, ThreadPriority, ThreadStatus } from "./types";

export type LoadScope = "screen" | "list" | "thread";

export type InboxController = {
  state: InboxScreenState;
  selectInbox: (inboxId: string) => void;
  selectThread: (threadId: string) => void;
  assignThread: (threadId: string, teammateId: string) => Promise<void>;
  setStatus: (threadId: string, status: ThreadStatus) => Promise<void>;
  setUnread: (threadId: string, unread: boolean) => Promise<void>;
  setPriority: (threadId: string, priority: ThreadPriority) => Promise<void>;
  setLabels: (threadId: string, labels: string[]) => Promise<void>;
  /** Copilot draft; `currentDraft` is the operator's in-progress text to refine. */
  generateDraft: (threadId: string, currentDraft?: string) => Promise<string>;
  sendReply: (threadId: string, body: string, bodyHtml?: string) => Promise<void>;
  /** Demo: deliver a synthetic inbound email (real company domain) into an inbox. */
  simulateEmail: (inboxId: string) => Promise<void>;
  retryLoad: (scope: LoadScope) => Promise<void>;
};

export type * from "./types";

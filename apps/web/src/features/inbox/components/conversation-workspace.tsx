import { Button } from "@reply/ui/components/button";
import { Skeleton } from "@reply/ui/components/skeleton";
import { MailOpen } from "lucide-react";

import type {
  OperationKey,
  OperationState,
  Teammate,
  ThreadDetail,
  ThreadPaneStatus,
  ThreadPriority,
  ThreadStatus,
} from "../types";

/** Thread-scoped actions derived from the controller for the selected thread. */
export type WorkspaceActions = {
  assign: (teammateId: string) => Promise<void>;
  setStatus: (status: ThreadStatus) => Promise<void>;
  setUnread: (unread: boolean) => Promise<void>;
  setPriority: (priority: ThreadPriority) => Promise<void>;
  setLabels: (labelIds: string[]) => Promise<void>;
  generateDraft: () => Promise<string>;
  sendReply: (body: string) => Promise<void>;
  retry: () => Promise<void>;
};

export type ConversationWorkspaceProps = {
  detail: ThreadDetail | null;
  status: ThreadPaneStatus;
  error?: string;
  teammates: Teammate[];
  operations: Record<OperationKey, OperationState>;
  actions: WorkspaceActions;
};

/**
 * Third column: conversation header, message timeline, company panel, and
 * reply composer.
 *
 * Wave 1B (F3+F4) replaces the internals with the full Figma treatment; the
 * props and outer geometry are frozen.
 */
export function ConversationWorkspace({ detail, status, error, actions }: ConversationWorkspaceProps) {
  if (status === "loading") {
    return (
      <div className="flex min-w-0 flex-1 flex-col" aria-busy="true" aria-label="Loading conversation">
        <div className="flex h-16 items-center gap-3 border-b border-(--inbox-border-subtle) px-4">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-5 w-48 rounded-md" />
        </div>
        <div className="flex-1 space-y-4 p-4">
          <Skeleton className="h-[152px] w-full rounded-xl" />
          <div className="flex justify-end">
            <Skeleton className="h-11 w-64 rounded-xl" />
          </div>
        </div>
        <div className="p-4 pt-0">
          <Skeleton className="h-[120px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center" role="alert">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-(--inbox-text)">
            {error ?? "This conversation could not load."}
          </p>
          <Button variant="outline" className="h-8 rounded-lg" onClick={actions.retry}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center">
        <div className="flex w-[280px] flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-(--inbox-active)">
            <MailOpen className="size-6 text-(--inbox-text-subtle)" aria-hidden />
          </div>
          <p className="mt-4 text-base font-semibold text-(--inbox-text-strong)">
            Select a conversation to view details
          </p>
          <p className="mt-1 text-sm leading-5 text-(--inbox-text-muted)">
            Choose a conversation from the list to read and reply.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-16 shrink-0 items-center border-b border-(--inbox-border-subtle) px-4">
        <p className="truncate text-base font-semibold tracking-[-0.1px] text-(--inbox-text-strong)">
          {detail.thread.subject}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <p className="text-sm text-(--inbox-text-muted)">
          {detail.messages.length} messages — full workspace lands with Wave 1B.
        </p>
      </div>
    </div>
  );
}

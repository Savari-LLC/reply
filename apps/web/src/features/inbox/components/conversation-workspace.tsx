import { Button } from "@reply/ui/components/button";
import { Skeleton } from "@reply/ui/components/skeleton";
import { MailOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type {
  OperationKey,
  OperationState,
  Teammate,
  ThreadDetail,
  ThreadPaneStatus,
  ThreadPriority,
  ThreadStatus,
} from "../types";
import { CompanyProfilePanel } from "./company-profile-panel";
import { ConversationHeader } from "./conversation-header";
import { MessageTimeline } from "./message-timeline";
import { ReplyComposer } from "./reply-composer";

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
  /** Increments on deliberate keyboard thread selection; moves focus to the heading when ready. */
  headingFocusToken?: number;
};

/**
 * Third column: conversation header, message timeline, optional company
 * panel, and the Reply Copilot composer.
 */
export function ConversationWorkspace({
  detail,
  status,
  error,
  teammates,
  operations,
  actions,
  headingFocusToken = 0,
}: ConversationWorkspaceProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const panelTriggerRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const lastFocusToken = useRef(headingFocusToken);

  // Focus the conversation heading after a keyboard-driven selection settles,
  // without stealing focus during background revalidation.
  useEffect(() => {
    if (status === "ready" && detail && headingFocusToken !== lastFocusToken.current) {
      lastFocusToken.current = headingFocusToken;
      headingRef.current?.focus();
    }
  }, [status, detail, headingFocusToken]);

  const closePanel = () => {
    setPanelOpen(false);
    panelTriggerRef.current?.focus();
  };

  if (status === "loading") {
    return (
      <div
        className="flex min-w-0 flex-1 flex-col"
        aria-busy="true"
        aria-label="Loading conversation"
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-(--inbox-border-subtle) px-4">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-5 w-48 rounded-md" />
          <div className="ml-auto flex items-center gap-1.5">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
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
        <div className="flex w-[320px] flex-col items-center gap-3 text-center">
          <p className="text-sm text-(--inbox-text)">
            {error ?? "This conversation could not load."}
          </p>
          <Button
            variant="outline"
            className="h-8 rounded-lg focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
            onClick={actions.retry}
          >
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
          <p className="mt-4 text-base font-semibold tracking-[-0.1px] text-(--inbox-text-strong)">
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
    <section className="flex min-w-0 flex-1 flex-col" aria-label="Conversation">
      <ConversationHeader
        thread={detail.thread}
        headingRef={headingRef}
        teammates={teammates}
        operations={operations}
        actions={actions}
        panelOpen={panelOpen}
        onTogglePanel={() => (panelOpen ? closePanel() : setPanelOpen(true))}
        panelTriggerRef={panelTriggerRef}
      />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <MessageTimeline threadId={detail.thread.id} messages={detail.messages} />
          {/* Keyed so a thread switch resets the local draft text. */}
          <ReplyComposer
            key={detail.thread.id}
            draftState={operations.draft}
            sendState={operations.send}
            onGenerateDraft={actions.generateDraft}
            onSendReply={actions.sendReply}
          />
        </div>
        {panelOpen ? (
          <CompanyProfilePanel
            company={detail.company}
            thread={detail.thread}
            onClose={closePanel}
          />
        ) : null}
      </div>
    </section>
  );
}

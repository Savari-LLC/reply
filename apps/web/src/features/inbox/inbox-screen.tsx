import { useMemo, useState } from "react";

import { ConversationWorkspace, type WorkspaceActions } from "./components/conversation-workspace";
import { InboxShellSkeleton } from "./components/inbox-shell-skeleton";
import { InboxSidebar } from "./components/inbox-sidebar";
import { ScreenErrorState } from "./components/screen-error-state";
import type { RailUser } from "./components/sidebar-rail";
import { ThreadList } from "./components/thread-list";
import type { WorkspaceSwitcherData } from "./components/workspace-switcher";
import type { ThreadFilter } from "./constants";
import type { InboxController } from "./model";
import type { ThreadViewer } from "./types";
import { filterThreads } from "./utils";

import "./inbox.css";

type InboxScreenProps = {
  controller: InboxController;
  /** Signed-in user shown in the rail; omitted in fixture/preview mode. */
  currentUser?: RailUser;
  onSignOut?: () => void;
  /** Teammates currently viewing the selected thread (live presence). */
  viewers?: ThreadViewer[];
  /** Workspace name + switcher shown at the top of the sidebar. */
  workspace?: WorkspaceSwitcherData;
};

/**
 * Desktop shared-inbox screen (1280–1440px). Pure presentation: all data and
 * effects flow through the `InboxController` seam.
 */
export function InboxScreen({ controller, currentUser, onSignOut, viewers, workspace }: InboxScreenProps) {
  const { state } = controller;
  const [filter, setFilter] = useState<ThreadFilter>("all");
  // Incremented on deliberate keyboard selection so the workspace moves focus
  // to the conversation heading once the thread is ready (F5).
  const [headingFocusToken, setHeadingFocusToken] = useState(0);

  const handleSelectThread = (threadId: string, viaKeyboard: boolean) => {
    controller.selectThread(threadId);
    if (viaKeyboard) setHeadingFocusToken((token) => token + 1);
  };

  const selectedInbox = state.inboxes.find((inbox) => inbox.id === state.selectedInboxId) ?? null;
  const visibleThreads = useMemo(() => filterThreads(state.threads, filter), [state.threads, filter]);

  const workspaceActions = useMemo<WorkspaceActions>(() => {
    const threadId = state.selectedThreadId;
    const requireThread = () => {
      if (!threadId) throw new Error("No thread selected");
      return threadId;
    };
    return {
      assign: (teammateId) => controller.assignThread(requireThread(), teammateId),
      setStatus: (status) => controller.setStatus(requireThread(), status),
      setUnread: (unread) => controller.setUnread(requireThread(), unread),
      setPriority: (priority) => controller.setPriority(requireThread(), priority),
      setLabels: (labelIds) => controller.setLabels(requireThread(), labelIds),
      generateDraft: (currentDraft, mode) =>
        controller.generateDraft(requireThread(), currentDraft, mode),
      sendReply: (body, bodyHtml) => controller.sendReply(requireThread(), body, bodyHtml),
      addComment: (draft) => controller.addComment(requireThread(), draft),
      retry: () => controller.retryLoad("thread"),
    };
  }, [controller, state.selectedThreadId]);

  return (
    <main className="inbox-root flex h-svh w-full min-w-[1024px] overflow-hidden bg-(--inbox-canvas) font-sans text-sm antialiased">
      <InboxSidebar
        inboxes={state.inboxes}
        selectedInboxId={state.selectedInboxId}
        onSelectInbox={controller.selectInbox}
        currentUser={currentUser}
        onSignOut={onSignOut}
        workspace={workspace}
      />
      <div className="flex min-w-0 flex-1 py-3 pr-3">
        <div className="flex min-w-0 flex-1 overflow-hidden rounded-xl bg-(--inbox-surface)">
          {state.screenStatus === "loading" ? (
            <InboxShellSkeleton />
          ) : state.screenStatus === "error" ? (
            <ScreenErrorState
              message={state.screenError}
              onRetry={() => controller.retryLoad("screen")}
            />
          ) : (
            <>
              <ThreadList
                inboxName={selectedInbox?.name ?? "Inbox"}
                threads={visibleThreads}
                hasAnyThreads={state.threads.length > 0}
                showConnectHint={selectedInbox ? !selectedInbox.hasChannel : false}
                teammates={state.teammates}
                selectedThreadId={state.selectedThreadId}
                status={state.listStatus}
                error={state.listError}
                filter={filter}
                onFilterChange={setFilter}
                onSelectThread={handleSelectThread}
                onClearFilters={() => setFilter("all")}
                onRetry={() => controller.retryLoad("list")}
                onSimulateEmail={
                  state.selectedInboxId
                    ? () =>
                        void controller
                          .simulateEmail(state.selectedInboxId!)
                          .catch(() => undefined)
                    : undefined
                }
                simulateState={state.operations.simulate}
              />
              <ConversationWorkspace
                detail={state.selectedThread}
                status={state.threadStatus}
                error={state.threadError}
                inboxName={selectedInbox?.name}
                viewers={viewers}
                teammates={state.teammates}
                operations={state.operations}
                actions={workspaceActions}
                headingFocusToken={headingFocusToken}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}

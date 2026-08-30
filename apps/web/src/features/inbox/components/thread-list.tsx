import { ListFilter } from "lucide-react";

import { FILTER_LABELS, THREAD_FILTERS, type ThreadFilter } from "../constants";
import type { ListStatus, Teammate, ThreadSummary } from "../types";
import {
  ThreadListEmptyFilter,
  ThreadListEmptyInbox,
  ThreadListError,
  ThreadListLoading,
} from "./thread-list-states";
import { ThreadRow } from "./thread-row";

export type ThreadListProps = {
  inboxName: string;
  /** Threads already narrowed to the active filter tab. */
  threads: ThreadSummary[];
  /** Whether the selected inbox has any threads before filtering. */
  hasAnyThreads: boolean;
  /** True when the inbox has no channel; empty state offers to connect one. */
  showConnectHint?: boolean;
  teammates: Teammate[];
  selectedThreadId: string | null;
  status: ListStatus;
  error?: string;
  filter: ThreadFilter;
  onFilterChange: (filter: ThreadFilter) => void;
  onSelectThread: (threadId: string, viaKeyboard: boolean) => void;
  onClearFilters: () => void;
  onRetry: () => Promise<void>;
};

/** Second column: thread list with filter tabs and pane-local list states. */
export function ThreadList(props: ThreadListProps) {
  const { inboxName, threads, status, filter, onFilterChange, selectedThreadId } = props;

  return (
    <section
      className="flex w-[clamp(300px,25vw,380px)] shrink-0 flex-col border-r border-(--inbox-border-subtle)"
      aria-label={`${inboxName} conversations`}
    >
      <header className="flex h-[100px] shrink-0 flex-col gap-3 px-4 pt-3">
        <div className="flex h-8 items-center gap-2">
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-[-0.1px] text-(--inbox-text-strong)">
            {inboxName}
          </h1>
          <button
            type="button"
            aria-label="Filter conversations"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-(--inbox-text) outline-none hover:bg-(--inbox-hover) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
          >
            <ListFilter className="size-4" aria-hidden />
          </button>
        </div>
        <div role="tablist" aria-label="Filter conversations" className="flex gap-1">
          {THREAD_FILTERS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={tab === filter}
              onClick={() => onFilterChange(tab)}
              className={`flex h-8 items-center rounded-lg border px-3 text-sm tracking-[-0.1px] outline-none focus-visible:ring-2 focus-visible:ring-(--inbox-primary) ${
                tab === filter
                  ? "border-(--inbox-border-strong) bg-(--inbox-active) font-medium text-(--inbox-text-strong)"
                  : "border-transparent text-(--inbox-text) hover:bg-(--inbox-hover)"
              }`}
            >
              {FILTER_LABELS[tab]}
            </button>
          ))}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <ThreadListBody {...props} />
      </div>
      {status === "ready" && threads.length > 0 ? (
        <span className="sr-only" aria-live="polite">
          {threads.length} conversations, {selectedThreadId ? "one selected" : "none selected"}
        </span>
      ) : null}
    </section>
  );
}

function ThreadListBody(props: ThreadListProps) {
  if (props.status === "loading") return <ThreadListLoading />;
  if (props.status === "error") return <ThreadListError onRetry={props.onRetry} />;
  if (props.status === "empty" || !props.hasAnyThreads) {
    return (
      <ThreadListEmptyInbox inboxName={props.inboxName} showConnectHint={props.showConnectHint} />
    );
  }
  if (props.threads.length === 0) {
    return <ThreadListEmptyFilter onClearFilters={props.onClearFilters} />;
  }
  return (
    <ul className="flex flex-col gap-2">
      {props.threads.map((thread) => (
        <li key={thread.id}>
          <ThreadRow
            thread={thread}
            assignee={props.teammates.find((teammate) => teammate.id === thread.assigneeId) ?? null}
            selected={thread.id === props.selectedThreadId}
            onSelect={props.onSelectThread}
          />
        </li>
      ))}
    </ul>
  );
}

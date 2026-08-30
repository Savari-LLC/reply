import { Button } from "@reply/ui/components/button";

import { FILTER_LABELS, THREAD_FILTERS, type ThreadFilter } from "../constants";
import type { ListStatus, Teammate, ThreadSummary } from "../types";
import { formatRelativeTime } from "../utils";
import { ThreadRowSkeleton } from "./inbox-shell-skeleton";

export type ThreadListProps = {
  inboxName: string;
  /** Threads already narrowed to the active filter tab. */
  threads: ThreadSummary[];
  /** Whether the selected inbox has any threads before filtering. */
  hasAnyThreads: boolean;
  teammates: Teammate[];
  selectedThreadId: string | null;
  status: ListStatus;
  error?: string;
  filter: ThreadFilter;
  onFilterChange: (filter: ThreadFilter) => void;
  onSelectThread: (threadId: string) => void;
  onClearFilters: () => void;
  onRetry: () => Promise<void>;
};

/**
 * Second column: thread list with filter tabs and list states.
 *
 * Wave 1A (F2) replaces the internals with the full Figma treatment; the
 * props and outer geometry are frozen.
 */
export function ThreadList(props: ThreadListProps) {
  const { inboxName, threads, status, filter, onFilterChange, onSelectThread, selectedThreadId } =
    props;

  return (
    <section
      className="flex w-[clamp(300px,25vw,380px)] shrink-0 flex-col border-r border-(--inbox-border-subtle)"
      aria-label={`${inboxName} conversations`}
    >
      <header className="flex h-[100px] shrink-0 flex-col justify-center gap-3 px-4">
        <h1 className="text-base font-semibold tracking-[-0.1px] text-(--inbox-text-strong)">
          {inboxName}
        </h1>
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

  function ThreadListBody(bodyProps: ThreadListProps) {
    if (bodyProps.status === "loading") {
      return (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 6 }, (_, index) => (
            <ThreadRowSkeleton key={index} />
          ))}
        </div>
      );
    }
    if (bodyProps.status === "error") {
      return (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center" role="alert">
          <p className="text-sm text-(--inbox-text)">Conversations could not load.</p>
          <Button variant="outline" className="h-8 rounded-lg" onClick={bodyProps.onRetry}>
            Retry
          </Button>
        </div>
      );
    }
    if (bodyProps.status === "empty" || !bodyProps.hasAnyThreads) {
      return (
        <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
          <p className="text-sm font-medium text-(--inbox-text-strong)">You’re all caught up</p>
          <p className="text-xs text-(--inbox-text-muted)">
            No conversations in {bodyProps.inboxName}.
          </p>
        </div>
      );
    }
    if (bodyProps.threads.length === 0) {
      return (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-sm text-(--inbox-text)">No conversations match this filter.</p>
          <Button variant="outline" className="h-8 rounded-lg" onClick={bodyProps.onClearFilters}>
            Clear filters
          </Button>
        </div>
      );
    }
    return (
      <ul className="flex flex-col gap-2">
        {bodyProps.threads.map((thread) => (
          <li key={thread.id}>
            <button
              type="button"
              onClick={() => onSelectThread(thread.id)}
              aria-current={thread.id === selectedThreadId ? "true" : undefined}
              className={`flex h-20 w-full flex-col justify-center gap-0.5 rounded-xl p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-(--inbox-primary) ${
                thread.id === selectedThreadId
                  ? "bg-(--inbox-active)"
                  : "hover:bg-(--inbox-hover)"
              }`}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span
                  className={`truncate text-sm tracking-[-0.1px] ${thread.unread ? "font-semibold text-(--inbox-text-strong)" : "font-medium text-(--inbox-text)"}`}
                >
                  {thread.customerName}
                </span>
                <span className="shrink-0 text-xs text-(--inbox-text-muted)">
                  {formatRelativeTime(thread.lastActivityAt)}
                </span>
              </span>
              <span className="truncate text-sm text-(--inbox-text)">{thread.subject}</span>
              <span className="truncate text-xs text-(--inbox-text-muted)">{thread.preview}</span>
            </button>
          </li>
        ))}
      </ul>
    );
  }
}

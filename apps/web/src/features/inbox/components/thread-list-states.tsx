import { Button } from "@reply/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Inbox as InboxIcon, Plug, SearchX } from "lucide-react";

import { ThreadRowSkeleton } from "./inbox-shell-skeleton";

export function ThreadListLoading() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading conversations">
      {Array.from({ length: 6 }, (_, index) => (
        <ThreadRowSkeleton key={index} />
      ))}
    </div>
  );
}

export function ThreadListError({ onRetry }: { onRetry: () => Promise<void> }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center" role="alert">
      <p className="text-sm text-(--inbox-text)">Conversations could not load.</p>
      <Button variant="outline" className="h-8 rounded-lg" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export function ThreadListEmptyInbox({
  inboxName,
  showConnectHint = false,
}: {
  inboxName: string;
  /** Shown when the inbox has no channel delivering into it yet. */
  showConnectHint?: boolean;
}) {
  if (showConnectHint) {
    return (
      <div className="flex flex-col items-center gap-1 px-4 py-12 text-center" role="status">
        <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-(--inbox-hover)">
          <Plug className="size-5 text-(--inbox-text-muted)" aria-hidden />
        </span>
        <p className="text-sm font-medium tracking-[-0.1px] text-(--inbox-text-strong)">
          No channel connected
        </p>
        <p className="text-xs tracking-[-0.1px] text-(--inbox-text-muted)">
          Connect a channel, or press Simulate above to deliver a demo email into{" "}
          {inboxName}.
        </p>
        <Link
          to="/settings"
          search={{ section: "inboxes" }}
          className="mt-3 flex h-8 items-center rounded-lg border border-(--inbox-border) bg-(--inbox-surface-elevated) px-3 text-sm font-medium tracking-[-0.1px] text-(--inbox-text) outline-none hover:bg-(--inbox-hover) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
        >
          Connect a channel
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-12 text-center" role="status">
      <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-(--inbox-hover)">
        <InboxIcon className="size-5 text-(--inbox-text-muted)" aria-hidden />
      </span>
      <p className="text-sm font-medium tracking-[-0.1px] text-(--inbox-text-strong)">
        You’re all caught up
      </p>
      <p className="text-xs tracking-[-0.1px] text-(--inbox-text-muted)">
        No conversations in {inboxName}. Press Simulate above to deliver a demo email.
      </p>
    </div>
  );
}

export function ThreadListEmptyFilter({ onClearFilters }: { onClearFilters: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center" role="status">
      <SearchX className="size-5 text-(--inbox-text-muted)" aria-hidden />
      <p className="text-sm text-(--inbox-text)">No conversations match this filter.</p>
      <Button variant="outline" className="h-8 rounded-lg" onClick={onClearFilters}>
        Clear filters
      </Button>
    </div>
  );
}

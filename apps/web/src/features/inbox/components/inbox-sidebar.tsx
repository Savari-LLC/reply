import { Inbox as InboxIcon, MessagesSquare, Settings } from "lucide-react";

import { LABEL_ACCENT_STYLES } from "../constants";
import type { InboxSummary } from "../types";

type InboxSidebarProps = {
  inboxes: InboxSummary[];
  selectedInboxId: string | null;
  onSelectInbox: (inboxId: string) => void;
};

/**
 * First column: 48px utility rail + fluid inbox navigation (224–248px total).
 *
 * Wave 1A (F2) replaces the internals with the full Figma treatment; the
 * props and outer geometry are frozen.
 */
export function InboxSidebar({ inboxes, selectedInboxId, onSelectInbox }: InboxSidebarProps) {
  return (
    <div className="flex h-full shrink-0">
      <div className="flex w-12 flex-col items-center gap-1.5 border-r border-(--inbox-border-subtle) bg-(--inbox-nav) px-2 py-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-(--inbox-action-secondary-hover)">
          <InboxIcon className="size-4" aria-hidden />
        </span>
        <span className="flex size-8 items-center justify-center rounded-lg text-(--inbox-text-subtle)">
          <MessagesSquare className="size-4" aria-hidden />
        </span>
        <span className="mt-auto flex size-8 items-center justify-center rounded-lg text-(--inbox-text-subtle)">
          <Settings className="size-4" aria-hidden />
        </span>
      </div>
      <nav
        className="flex w-[clamp(176px,13vw,200px)] flex-col gap-1 bg-(--inbox-nav) p-3"
        aria-label="Shared inboxes"
      >
        <p className="px-1 pb-2 text-base font-semibold tracking-[-0.1px] text-(--inbox-text-strong)">
          Inbox
        </p>
        {inboxes.map((inbox) => {
          const selected = inbox.id === selectedInboxId;
          return (
            <button
              key={inbox.id}
              type="button"
              onClick={() => onSelectInbox(inbox.id)}
              aria-current={selected ? "true" : undefined}
              className={`flex h-8 w-full items-center gap-2 rounded-lg px-3 text-sm tracking-[-0.1px] outline-none focus-visible:ring-2 focus-visible:ring-(--inbox-primary) ${
                selected
                  ? "bg-(--inbox-surface) font-medium text-(--inbox-text-strong) shadow-(--inbox-shadow-sm)"
                  : "text-(--inbox-text) hover:bg-(--inbox-hover)"
              }`}
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: LABEL_ACCENT_STYLES[inbox.accent].dot }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-left">{inbox.name}</span>
              {inbox.unreadCount > 0 ? (
                <span className="text-xs text-(--inbox-text-muted)">{inbox.unreadCount}</span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

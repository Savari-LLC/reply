import { ChevronDown, Search } from "lucide-react";

import { LABEL_ACCENT_STYLES } from "../constants";
import type { InboxSummary } from "../types";
import { SidebarRail, type RailUser } from "./sidebar-rail";

type InboxSidebarProps = {
  inboxes: InboxSummary[];
  selectedInboxId: string | null;
  onSelectInbox: (inboxId: string) => void;
  currentUser?: RailUser;
  onSignOut?: () => void;
};

/** First column: 48px utility rail + fluid inbox navigation (224–248px total). */
export function InboxSidebar({
  inboxes,
  selectedInboxId,
  onSelectInbox,
  currentUser,
  onSignOut,
}: InboxSidebarProps) {
  return (
    <div className="flex h-full shrink-0">
      <SidebarRail user={currentUser} onSignOut={onSignOut} />
      <div className="flex w-[clamp(176px,13vw,200px)] flex-col overflow-y-auto bg-(--inbox-nav)">
        <div className="flex flex-col gap-3 p-3">
          <div className="flex h-8 w-full items-center gap-2 rounded-lg border border-(--inbox-border) bg-(--inbox-surface) p-2">
            <span
              className="size-5 shrink-0 rounded-md bg-(--inbox-action-secondary)"
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-sm tracking-[-0.1px] text-(--inbox-text)">
              Reply Workspace
            </span>
            <ChevronDown className="size-4 shrink-0 text-(--inbox-text-muted)" aria-hidden />
          </div>
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-base font-semibold tracking-[-0.1px] text-(--inbox-text-strong)">
              Inbox
            </p>
            <button
              type="button"
              aria-label="Search conversations"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-(--inbox-text) outline-none hover:bg-(--inbox-hover) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
            >
              <Search className="size-4" aria-hidden />
            </button>
          </div>
        </div>
        <div className="mx-3 h-px shrink-0 bg-(--inbox-border-subtle)" aria-hidden />
        <nav className="flex flex-col gap-1 px-3 py-2" aria-label="Inboxes">
          <InboxGroup
            title="Your inbox"
            inboxes={inboxes.filter((inbox) => inbox.kind === "personal")}
            selectedInboxId={selectedInboxId}
            onSelectInbox={onSelectInbox}
          />
          <InboxGroup
            title="Shared inboxes"
            inboxes={inboxes.filter((inbox) => inbox.kind !== "personal")}
            selectedInboxId={selectedInboxId}
            onSelectInbox={onSelectInbox}
          />
        </nav>
      </div>
    </div>
  );
}

function InboxGroup({
  title,
  inboxes,
  selectedInboxId,
  onSelectInbox,
}: {
  title: string;
  inboxes: InboxSummary[];
  selectedInboxId: string | null;
  onSelectInbox: (inboxId: string) => void;
}) {
  if (inboxes.length === 0) return null;
  return (
    <>
      <p className="px-3 pt-1 pb-1 text-xs font-medium tracking-[-0.1px] text-(--inbox-text-muted)">
        {title}
      </p>
      {inboxes.map((inbox) => {
        const selected = inbox.id === selectedInboxId;
        return (
          <button
            key={inbox.id}
            type="button"
            onClick={() => onSelectInbox(inbox.id)}
            aria-current={selected ? "true" : undefined}
            className={`flex h-8 w-full shrink-0 items-center gap-2 rounded-lg px-3 text-sm tracking-[-0.1px] outline-none focus-visible:ring-2 focus-visible:ring-(--inbox-primary) ${
              selected
                ? "bg-(--inbox-surface) text-(--inbox-text-strong) shadow-(--inbox-shadow-sm)"
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
              <span className="shrink-0 text-xs font-medium tracking-[-0.1px] text-(--inbox-text-muted)">
                {inbox.unreadCount}
                <span className="sr-only"> unread</span>
              </span>
            ) : null}
          </button>
        );
      })}
    </>
  );
}

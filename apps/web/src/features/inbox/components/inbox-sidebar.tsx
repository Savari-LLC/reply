import {
  AtSign,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Mail,
  MailOpen,
  Plus,
} from "lucide-react";
import { useState } from "react";

import { ReplyLogoMark } from "@/components/reply-logo";

import { INBOX_VIEW_LABELS, LABEL_ACCENT_STYLES } from "../constants";
import type { InboxSummary, InboxView } from "../types";
import { NewMessageDialog } from "./new-message-dialog";
import { SidebarRail, type RailUser } from "./sidebar-rail";
import { WorkspaceSwitcher, type WorkspaceSwitcherData } from "./workspace-switcher";

type InboxSidebarProps = {
  inboxes: InboxSummary[];
  selectedInboxId: string | null;
  selectedView: InboxView;
  onSelectInbox: (inboxId: string, view?: InboxView) => void;
  currentUser?: RailUser;
  onSignOut?: () => void;
  /** Live workspace switcher; fixture mode falls back to a static placeholder. */
  workspace?: WorkspaceSwitcherData;
};

const ROW =
  "flex h-8 w-full shrink-0 items-center gap-2 rounded-lg px-3 text-sm tracking-[-0.1px] outline-none focus-visible:ring-2 focus-visible:ring-(--inbox-primary)";
const ROW_IDLE = "text-(--inbox-text) hover:bg-(--inbox-hover)";
const ROW_SELECTED = "bg-(--inbox-surface) text-(--inbox-text-strong) shadow-(--inbox-shadow-sm)";

/** Views under each shared inbox, scoped server-side by `listThreads`. */
const SHARED_VIEWS = ["open", "assigned", "done"] as const;

/** Personal views; Mentions spans every inbox the member can access. */
const PERSONAL_VIEWS = [
  { view: "open", Icon: MailOpen },
  { view: "done", Icon: CheckCircle2 },
  { view: "mentions", Icon: AtSign },
] as const;

function CountBadge({ count, label = "unread" }: { count: number; label?: string }) {
  if (count <= 0) return null;
  return (
    <span className="flex min-w-6 shrink-0 items-center justify-center rounded-full px-1 text-xs font-medium tracking-[-0.1px] text-(--inbox-text-strong) opacity-50">
      {count}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

/** First column: 48px utility rail + fluid inbox navigation (224–248px total). */
export function InboxSidebar({
  inboxes,
  selectedInboxId,
  selectedView,
  onSelectInbox,
  currentUser,
  onSignOut,
  workspace,
}: InboxSidebarProps) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const personalInboxes = inboxes.filter((inbox) => inbox.kind === "personal");
  const sharedInboxes = inboxes.filter((inbox) => inbox.kind !== "personal");

  return (
    <div className="group/sidebar relative flex h-full shrink-0">
      <SidebarRail
        user={currentUser}
        onSignOut={onSignOut}
        onToggleNav={() => setCollapsed((value) => !value)}
        navCollapsed={collapsed}
      />
      <div
        className={
          collapsed
            ? // Collapsed: the panel floats over the content and only appears
              // while the pointer (or focus) is on the left edge of the screen.
              "absolute inset-y-0 left-12 z-20 hidden w-[clamp(184px,14vw,216px)] flex-col overflow-y-auto border-r border-(--inbox-border-subtle) bg-(--inbox-nav) shadow-(--inbox-shadow-sm) group-focus-within/sidebar:flex group-hover/sidebar:flex"
            : "flex w-[clamp(184px,14vw,216px)] flex-col overflow-y-auto bg-(--inbox-nav)"
        }
      >
        <div className="flex flex-col gap-3 p-3">
          {workspace ? (
            <WorkspaceSwitcher {...workspace} />
          ) : (
            <div className="flex h-8 w-full items-center gap-2 rounded-lg border border-(--inbox-border) bg-(--inbox-surface) p-2">
              <span
                className="flex size-5 shrink-0 items-center justify-center rounded-md bg-[#0d9488]"
                aria-hidden
              >
                <ReplyLogoMark className="h-3 w-auto text-white" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm tracking-[-0.1px] text-(--inbox-text)">
                Reply Workspace
              </span>
              <ChevronDown className="size-4 shrink-0 text-(--inbox-text-muted)" aria-hidden />
            </div>
          )}
          <div className="flex h-8 items-center">
            <p className="min-w-0 flex-1 truncate text-base font-semibold tracking-[-0.1px] text-(--inbox-text-strong)">
              Inbox
            </p>
          </div>
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-(--inbox-action-secondary) text-sm font-medium tracking-[-0.1px] text-(--inbox-text) outline-none transition-colors hover:bg-(--inbox-action-secondary-hover) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
          >
            <Plus className="size-4" aria-hidden />
            New Message
          </button>
        </div>
        <div className="mx-3 h-px shrink-0 bg-(--inbox-border-subtle)" aria-hidden />
        <nav className="flex flex-col gap-0.5 px-3 py-2" aria-label="Inboxes">
          {personalInboxes.map((inbox) =>
            PERSONAL_VIEWS.map(({ view, Icon }) => {
              const selected = inbox.id === selectedInboxId && selectedView === view;
              return (
                <button
                  key={`${inbox.id}-${view}`}
                  type="button"
                  onClick={() => onSelectInbox(inbox.id, view)}
                  aria-current={selected ? "true" : undefined}
                  className={`${ROW} ${selected ? ROW_SELECTED : ROW_IDLE}`}
                >
                  <Icon className="size-4 shrink-0 text-(--inbox-text-subtle)" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-left">
                    {INBOX_VIEW_LABELS[view]}
                  </span>
                  {view === "open" ? <CountBadge count={inbox.openCount} label="open" /> : null}
                </button>
              );
            }),
          )}

          {sharedInboxes.length > 0 ? (
            <p className="px-3 pt-4 pb-1 text-xs font-medium tracking-[-0.1px] text-(--inbox-text-muted)">
              Shared inboxes
            </p>
          ) : null}
          {sharedInboxes.map((inbox) => (
            <SharedInboxGroup
              key={inbox.id}
              inbox={inbox}
              selectedView={inbox.id === selectedInboxId ? selectedView : null}
              onSelect={(view) => onSelectInbox(inbox.id, view)}
            />
          ))}
        </nav>
      </div>
      <NewMessageDialog open={composerOpen} onOpenChange={setComposerOpen} />
    </div>
  );
}

/**
 * Shared inbox with collapsible Open/Assigned/Done views (Figma sidebar).
 * Each view scopes the thread list server-side via `listThreads`; the header
 * row only expands/collapses — there is no "all conversations" view.
 */
function SharedInboxGroup({
  inbox,
  selectedView,
  onSelect,
}: {
  inbox: InboxSummary;
  /** Active view when this inbox is selected; null when another inbox is. */
  selectedView: InboxView | null;
  onSelect: (view?: InboxView) => void;
}) {
  const [expanded, setExpanded] = useState(selectedView !== null);
  const accent = LABEL_ACCENT_STYLES[inbox.accent];
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className={`${ROW} ${ROW_IDLE} gap-0 px-0`}
      >
        <span className="flex h-full min-w-0 flex-1 items-center gap-2 pl-3">
          <span
            className="flex size-4 shrink-0 items-center justify-center rounded"
            style={{ backgroundColor: accent.dot }}
            aria-hidden
          >
            <Mail className="size-2.5 text-white" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 truncate text-left">{inbox.name}</span>
        </span>
        <CountBadge count={inbox.unreadCount} />
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg text-(--inbox-text-muted)">
          <Chevron className="size-4" aria-hidden />
        </span>
      </button>
      {expanded ? (
        <div className="flex flex-col gap-0.5">
          {SHARED_VIEWS.map((view) => {
            const viewSelected = selectedView === view;
            return (
              <button
                key={view}
                type="button"
                onClick={() => onSelect(view)}
                aria-current={viewSelected ? "true" : undefined}
                className={`flex h-8 w-full shrink-0 items-center rounded-lg pl-9 pr-3 text-xs tracking-[-0.1px] outline-none focus-visible:ring-2 focus-visible:ring-(--inbox-primary) ${
                  viewSelected
                    ? "bg-(--inbox-surface) font-medium text-(--inbox-text-strong) shadow-(--inbox-shadow-sm)"
                    : "text-(--inbox-text) hover:bg-(--inbox-hover)"
                }`}
              >
                <span className="min-w-0 flex-1 truncate text-left">
                  {INBOX_VIEW_LABELS[view]}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

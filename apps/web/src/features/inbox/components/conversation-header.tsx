import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@reply/ui/components/dropdown-menu";
import { Spinner } from "@reply/ui/components/spinner";
import {
  Check,
  ChevronDown,
  CircleCheck,
  EllipsisVertical,
  Inbox,
  Mail,
  MailOpen,
  PanelRight,
  TriangleAlert,
} from "lucide-react";
import type { RefObject } from "react";

import { LABEL_ACCENT_STYLES, STATUS_LABELS } from "../constants";
import type {
  OperationKey,
  OperationState,
  Teammate,
  ThreadSummary,
  ThreadViewer,
} from "../types";
import { ClassificationBadge } from "./classification-badge";
import { ConversationAvatar } from "./conversation-avatar";
import { ConversationViewers } from "./conversation-viewers";
import type { WorkspaceActions } from "./conversation-workspace";

const CONTROL =
  "flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-(--inbox-border) bg-(--inbox-surface-elevated) px-2.5 text-sm tracking-[-0.1px] text-(--inbox-text) outline-none transition-colors hover:bg-(--inbox-hover) focus-visible:ring-2 focus-visible:ring-(--inbox-primary) disabled:pointer-events-none disabled:opacity-60";

const ICON_CONTROL =
  "flex size-8 shrink-0 items-center justify-center rounded-lg text-(--inbox-text-subtle) outline-none transition-colors hover:bg-(--inbox-hover) hover:text-(--inbox-text) focus-visible:ring-2 focus-visible:ring-(--inbox-primary) disabled:pointer-events-none disabled:opacity-60";

const MENU =
  "min-w-48 rounded-lg border border-(--inbox-border) bg-(--inbox-surface-elevated) p-1 shadow-lg shadow-black/5";

const MENU_ITEM = "rounded-md text-sm text-(--inbox-text)";

export type ConversationHeaderProps = {
  thread: ThreadSummary;
  /** Focus target after keyboard-driven thread selection. */
  headingRef?: RefObject<HTMLHeadingElement | null>;
  inboxName?: string;
  viewers?: ThreadViewer[];
  teammates: Teammate[];
  operations: Record<OperationKey, OperationState>;
  actions: Pick<
    WorkspaceActions,
    "assign" | "setStatus" | "setUnread" | "setPriority" | "setLabels"
  >;
  panelOpen: boolean;
  onTogglePanel: () => void;
  /** Focus returns here when the company panel closes. */
  panelTriggerRef: RefObject<HTMLButtonElement | null>;
};

/**
 * h-16 conversation header (Figma 16329:28233): identity, urgency, inbox and
 * labels on the left; overflow menu, live Viewing pill, Assign, Done, and the
 * company-panel toggle on the right.
 */
export function ConversationHeader({
  thread,
  headingRef,
  inboxName,
  viewers = [],
  teammates,
  operations,
  actions,
  panelOpen,
  onTogglePanel,
  panelTriggerRef,
}: ConversationHeaderProps) {
  const assignee = teammates.find((teammate) => teammate.id === thread.assigneeId) ?? null;
  const isClosed = thread.status === "closed";
  const isUrgent = thread.priority === "urgent";
  const loading = (key: OperationKey) => operations[key].status === "loading";
  const overflowBusy =
    loading("priority") || loading("unread") || loading("labels") || loading("status");

  const toggleLabel = (labelId: string, checked: boolean) => {
    const ids = thread.labels.map((label) => label.id);
    const next = checked
      ? ids.includes(labelId)
        ? ids
        : [...ids, labelId]
      : ids.filter((id) => id !== labelId);
    void actions.setLabels(next);
  };

  return (
    <header className="flex shrink-0 flex-col gap-2 border-b border-(--inbox-border-subtle) px-4 py-3">
      {/* Row 1: identity + quiet controls */}
      <div className="flex h-8 items-center gap-2">
        <ConversationAvatar
          name={thread.customerName}
          imageUrl={thread.companyLogoUrl}
          online
        />
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="min-w-0 truncate rounded-sm text-base font-semibold tracking-[-0.1px] text-(--inbox-text-strong) outline-none focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
        >
          {thread.subject}
        </h2>
        {isUrgent ? (
          <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
            Urgent
          </span>
        ) : null}
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {/* Overflow: priority, read state, status moves, labels */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={ICON_CONTROL}
              aria-label="More conversation actions"
              disabled={overflowBusy}
            >
              {overflowBusy ? (
                <Spinner className="size-3.5" />
              ) : (
                <EllipsisVertical className="size-4" aria-hidden />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent className={MENU} align="end">
              <DropdownMenuItem
                className={MENU_ITEM}
                onClick={() => void actions.setPriority(isUrgent ? "normal" : "urgent")}
              >
                <TriangleAlert
                  className={`size-4 ${isUrgent ? "text-destructive" : "text-(--inbox-text-subtle)"}`}
                  aria-hidden
                />
                {isUrgent ? "Remove urgent" : "Mark urgent"}
              </DropdownMenuItem>
              <DropdownMenuItem
                className={MENU_ITEM}
                onClick={() => void actions.setUnread(!thread.unread)}
              >
                {thread.unread ? (
                  <MailOpen className="size-4 text-(--inbox-text-subtle)" aria-hidden />
                ) : (
                  <Mail className="size-4 text-(--inbox-text-subtle)" aria-hidden />
                )}
                {thread.unread ? "Mark as read" : "Mark as unread"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* GroupLabel needs a Group ancestor; Base UI throws without one. */}
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs font-medium text-(--inbox-text-muted)">
                  Status
                </DropdownMenuLabel>
                {(["open", "waiting"] as const).map((status) => (
                  <DropdownMenuItem
                    key={status}
                    className={MENU_ITEM}
                    onClick={() => void actions.setStatus(status)}
                  >
                    {STATUS_LABELS[status]}
                    {status === thread.status ? (
                      <Check className="ml-auto size-3.5 text-(--inbox-primary)" aria-hidden />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              {thread.labels.length > 0 ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-xs font-medium text-(--inbox-text-muted)">
                      Labels
                    </DropdownMenuLabel>
                    {thread.labels.map((label) => (
                      <DropdownMenuCheckboxItem
                        key={label.id}
                        checked
                        onCheckedChange={(checked) => toggleLabel(label.id, checked)}
                        className={MENU_ITEM}
                      >
                        <span
                          className="size-1.5 rounded-full"
                          style={{ backgroundColor: LABEL_ACCENT_STYLES[label.accent].dot }}
                          aria-hidden
                        />
                        {label.name}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuGroup>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="h-4 w-px bg-(--inbox-border)" aria-hidden />
          <button
            type="button"
            ref={panelTriggerRef}
            aria-label="Company details"
            aria-expanded={panelOpen}
            onClick={onTogglePanel}
            className={`${ICON_CONTROL} ${panelOpen ? "bg-(--inbox-active) text-(--inbox-text)" : ""}`}
          >
            <PanelRight className="size-4" aria-hidden />
          </button>
        </span>
      </div>

      {/* Row 2: context pills + primary actions */}
      <div className="flex h-8 items-center gap-2">
        <span className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          {inboxName ? (
            <span className="flex h-6 shrink-0 items-center gap-1 rounded-full bg-(--inbox-hover) px-2 text-xs font-medium tracking-[-0.1px] text-(--inbox-text-strong)">
              <Inbox className="size-3.5 text-(--inbox-text-subtle)" aria-hidden />
              {inboxName}
            </span>
          ) : null}
          <span className="shrink-0 rounded-full border border-(--inbox-border) bg-(--inbox-surface) px-2 py-0.5 text-xs font-medium text-(--inbox-text)">
            {STATUS_LABELS[thread.status]}
          </span>
          {thread.classification ? (
            <ClassificationBadge classification={thread.classification} />
          ) : null}
          {thread.labels.map((label) => {
            const accent = LABEL_ACCENT_STYLES[label.accent];
            return (
              <span
                key={label.id}
                className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: accent.bg, color: accent.text }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: accent.dot }}
                  aria-hidden
                />
                {label.name}
              </span>
            );
          })}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {/* Live presence */}
          <ConversationViewers viewers={viewers} />

        {/* Assignment */}
        <DropdownMenu>
          <DropdownMenuTrigger className={CONTROL} disabled={loading("assign")}>
            {loading("assign") ? (
              <Spinner className="size-3.5" />
            ) : assignee ? (
              <ConversationAvatar name={assignee.name} size={20} />
            ) : null}
            <span className="max-w-32 truncate">{assignee ? assignee.name : "Assign"}</span>
            <ChevronDown className="size-3.5 text-(--inbox-text-muted)" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent className={MENU} align="end">
            {teammates.map((teammate) => (
              <DropdownMenuItem
                key={teammate.id}
                className={MENU_ITEM}
                onClick={() => void actions.assign(teammate.id)}
              >
                <ConversationAvatar name={teammate.name} size={24} />
                <span className="text-sm text-(--inbox-text)">{teammate.name}</span>
                {teammate.id === thread.assigneeId ? (
                  <Check className="ml-auto size-3.5 text-(--inbox-primary)" aria-hidden />
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Prominent Done */}
        <button
          type="button"
          disabled={loading("status") || isClosed}
          onClick={() => void actions.setStatus("closed")}
          className={
            isClosed
              ? `${CONTROL} text-(--inbox-primary-text) disabled:opacity-100`
              : "flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-(--inbox-primary) px-3 text-sm font-medium tracking-[-0.1px] text-(--inbox-text-inverse) outline-none transition-colors hover:bg-(--inbox-primary)/90 focus-visible:ring-2 focus-visible:ring-(--inbox-primary) focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
          }
        >
          {loading("status") ? (
            <Spinner className="size-3.5" />
          ) : isClosed ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <CircleCheck className="size-4" aria-hidden />
          )}
          Done
          </button>
        </span>
      </div>
    </header>
  );
}

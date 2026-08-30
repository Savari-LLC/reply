import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@reply/ui/components/dropdown-menu";
import { Spinner } from "@reply/ui/components/spinner";
import {
  Check,
  ChevronDown,
  CircleCheck,
  Mail,
  MailOpen,
  PanelRight,
  Tag,
  TriangleAlert,
} from "lucide-react";
import type { RefObject } from "react";

import { LABEL_ACCENT_STYLES, STATUS_LABELS } from "../constants";
import type { OperationKey, OperationState, Teammate, ThreadStatus, ThreadSummary } from "../types";
import { ConversationAvatar } from "./conversation-avatar";
import type { WorkspaceActions } from "./conversation-workspace";

const CONTROL =
  "flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-(--inbox-border) bg-(--inbox-surface-elevated) px-2.5 text-sm tracking-[-0.1px] text-(--inbox-text) outline-none transition-colors hover:bg-(--inbox-hover) focus-visible:ring-2 focus-visible:ring-(--inbox-primary) disabled:pointer-events-none disabled:opacity-60";

const ICON_CONTROL =
  "flex size-8 shrink-0 items-center justify-center rounded-lg text-(--inbox-text-subtle) outline-none transition-colors hover:bg-(--inbox-hover) hover:text-(--inbox-text) focus-visible:ring-2 focus-visible:ring-(--inbox-primary) disabled:pointer-events-none disabled:opacity-60";

const MENU =
  "min-w-44 rounded-lg border border-(--inbox-border) bg-(--inbox-surface-elevated) p-1 shadow-(--inbox-shadow-sm)";

const STATUS_OPTIONS: ThreadStatus[] = ["open", "waiting", "closed"];

export type ConversationHeaderProps = {
  thread: ThreadSummary;
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

/** h-16 conversation header: customer identity on the left, mutation controls on the right. */
export function ConversationHeader({
  thread,
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
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-(--inbox-border-subtle) px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <ConversationAvatar name={thread.customerName} online />
        <h2 className="min-w-0 truncate text-base font-semibold tracking-[-0.1px] text-(--inbox-text-strong)">
          {thread.subject}
        </h2>
        {isUrgent ? (
          <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
            Urgent
          </span>
        ) : null}
        <span className="h-4 w-px shrink-0 bg-(--inbox-border)" aria-hidden />
        <span className="shrink-0 rounded-full border border-(--inbox-border) bg-(--inbox-surface) px-2 py-0.5 text-xs font-medium text-(--inbox-text)">
          {STATUS_LABELS[thread.status]}
        </span>
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
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {/* Assignment */}
        <DropdownMenu>
          <DropdownMenuTrigger className={CONTROL} disabled={loading("assign")}>
            {loading("assign") ? (
              <Spinner className="size-3.5" />
            ) : assignee ? (
              <ConversationAvatar name={assignee.name} size={20} />
            ) : null}
            <span className="max-w-32 truncate">{assignee ? assignee.name : "Unassigned"}</span>
            <ChevronDown className="size-3.5 text-(--inbox-text-muted)" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent className={MENU} align="end">
            {teammates.map((teammate) => (
              <DropdownMenuItem
                key={teammate.id}
                className="rounded-md"
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

        {/* Status */}
        <DropdownMenu>
          <DropdownMenuTrigger className={CONTROL} disabled={loading("status")}>
            {loading("status") ? <Spinner className="size-3.5" /> : null}
            {STATUS_LABELS[thread.status]}
            <ChevronDown className="size-3.5 text-(--inbox-text-muted)" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent className={MENU} align="end">
            {STATUS_OPTIONS.map((status) => (
              <DropdownMenuItem
                key={status}
                className="rounded-md text-sm text-(--inbox-text)"
                onClick={() => void actions.setStatus(status)}
              >
                {STATUS_LABELS[status]}
                {status === thread.status ? (
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

        {/* Priority toggle */}
        <button
          type="button"
          aria-label={isUrgent ? "Remove urgent" : "Mark urgent"}
          aria-pressed={isUrgent}
          disabled={loading("priority")}
          onClick={() => void actions.setPriority(isUrgent ? "normal" : "urgent")}
          className={`${ICON_CONTROL} ${isUrgent ? "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive" : ""}`}
        >
          {loading("priority") ? (
            <Spinner className="size-3.5" />
          ) : (
            <TriangleAlert className="size-4" aria-hidden />
          )}
        </button>

        {/* Read / unread toggle */}
        <button
          type="button"
          aria-label={thread.unread ? "Mark as read" : "Mark as unread"}
          disabled={loading("unread")}
          onClick={() => void actions.setUnread(!thread.unread)}
          className={ICON_CONTROL}
        >
          {loading("unread") ? (
            <Spinner className="size-3.5" />
          ) : thread.unread ? (
            <Mail className="size-4" aria-hidden />
          ) : (
            <MailOpen className="size-4" aria-hidden />
          )}
        </button>

        {/* Labels */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={ICON_CONTROL}
            aria-label="Labels"
            disabled={loading("labels")}
          >
            {loading("labels") ? <Spinner className="size-3.5" /> : <Tag className="size-4" aria-hidden />}
          </DropdownMenuTrigger>
          <DropdownMenuContent className={MENU} align="end">
            {thread.labels.length === 0 ? (
              <DropdownMenuItem disabled className="rounded-md text-sm text-(--inbox-text-muted)">
                No labels on this conversation
              </DropdownMenuItem>
            ) : (
              thread.labels.map((label) => (
                <DropdownMenuCheckboxItem
                  key={label.id}
                  checked
                  onCheckedChange={(checked) => toggleLabel(label.id, checked)}
                  className="rounded-md text-sm text-(--inbox-text)"
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: LABEL_ACCENT_STYLES[label.accent].dot }}
                    aria-hidden
                  />
                  {label.name}
                </DropdownMenuCheckboxItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="h-4 w-px bg-(--inbox-border)" aria-hidden />

        {/* Company context toggle */}
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
      </div>
    </header>
  );
}

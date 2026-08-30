import { LABEL_ACCENT_STYLES } from "../constants";
import type { Teammate, ThreadSummary } from "../types";
import { formatRelativeTime, getAvatarTint, getInitials } from "../utils";

type ThreadRowProps = {
  thread: ThreadSummary;
  assignee: Teammate | null;
  selected: boolean;
  onSelect: (threadId: string, viaKeyboard: boolean) => void;
};

/**
 * Thread-list row: avatar plus name/subject/preview lines, with urgency,
 * labels, and the assignee on a dedicated metadata row so badges never
 * overlap the text. The metadata row always renders to keep row heights
 * uniform.
 */
export function ThreadRow({ thread, assignee, selected, onSelect }: ThreadRowProps) {
  return (
    <button
      type="button"
      // detail === 0 means the click came from a keyboard activation.
      onClick={(event) => onSelect(thread.id, event.detail === 0)}
      aria-current={selected ? "true" : undefined}
      className={`flex w-full items-start gap-3 rounded-xl p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-(--inbox-primary) ${
        selected ? "bg-(--inbox-active)" : "hover:bg-(--inbox-hover)"
      }`}
    >
      <span className="relative shrink-0" aria-hidden>
        {thread.companyLogoUrl ? (
          <span className="flex size-8 items-center justify-center overflow-hidden rounded-full border border-(--inbox-border) bg-white">
            <img src={thread.companyLogoUrl} alt="" className="size-full object-contain p-0.5" />
          </span>
        ) : (
          <span
            className="flex size-8 items-center justify-center rounded-full text-xs font-medium text-(--inbox-text)"
            style={{ backgroundColor: getAvatarTint(thread.customerName) }}
          >
            {getInitials(thread.customerName)}
          </span>
        )}
        <span className="absolute right-0 bottom-0 size-2 rounded-full bg-(--inbox-success) ring-2 ring-(--inbox-surface)" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex h-5 items-center gap-1.5">
          <span
            className={`min-w-0 truncate text-sm tracking-[-0.1px] ${
              thread.unread
                ? "font-semibold text-(--inbox-text-strong)"
                : "font-medium text-(--inbox-text)"
            }`}
          >
            {thread.customerName}
          </span>
          {thread.unread ? (
            <span className="size-2 shrink-0 rounded-full bg-(--inbox-primary)" aria-hidden />
          ) : null}
          {thread.unread ? <span className="sr-only">Unread</span> : null}
          <span className="ml-auto shrink-0 text-xs font-medium tracking-[-0.1px] text-(--inbox-text-muted)">
            {formatRelativeTime(thread.lastActivityAt)}
          </span>
        </span>
        <span className="block h-5 truncate text-sm leading-5 text-(--inbox-text-subtle)">
          {thread.subject}
        </span>
        <span className="block h-4 truncate text-xs leading-4 tracking-[-0.1px] text-(--inbox-text-muted)">
          {thread.preview}
        </span>
        <span className="mt-1 flex h-5 items-center gap-1.5">
          {thread.priority === "urgent" ? (
            <span className="bg-destructive/10 text-destructive shrink-0 rounded-full px-1.5 text-xs font-medium tracking-[-0.1px]">
              Urgent
            </span>
          ) : null}
          <span className="flex min-w-0 items-center gap-1.5 overflow-hidden">
            {thread.labels.map((label) => {
              const accent = LABEL_ACCENT_STYLES[label.accent];
              return (
                <span
                  key={label.id}
                  className="shrink-0 rounded-full px-1.5 text-xs font-medium tracking-[-0.1px]"
                  style={{ backgroundColor: accent.bg, color: accent.text }}
                >
                  {label.name}
                </span>
              );
            })}
          </span>
          {assignee ? (
            <span
              className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-(--inbox-text)"
              style={{ backgroundColor: getAvatarTint(assignee.name) }}
              title={`Assigned to ${assignee.name}`}
            >
              {assignee.initials}
              <span className="sr-only">{` Assigned to ${assignee.name}`}</span>
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

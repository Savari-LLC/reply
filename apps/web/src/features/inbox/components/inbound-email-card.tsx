import { Reply } from "lucide-react";

import type { Message } from "../types";
import { formatRelativeTime } from "../utils";
import { ConversationAvatar } from "./conversation-avatar";

type InboundEmailCardProps = {
  message: Message;
  /** Renders the reply icon (latest inbound message) and opens the full composer. */
  onReply?: () => void;
};

/** Full-width white inbound email card from the mail-reply reference. */
export function InboundEmailCard({ message, onReply }: InboundEmailCardProps) {
  return (
    <article className="rounded-xl border border-(--inbox-border) bg-(--inbox-surface-elevated) shadow-(--inbox-shadow-card)">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="flex min-w-0 items-start gap-3">
          <ConversationAvatar name={message.authorName} online />
          <div className="min-w-0">
            <p className="flex min-w-0 items-baseline gap-2">
              <span className="truncate text-sm font-semibold tracking-[-0.1px] text-(--inbox-text-strong)">
                {message.authorName}
              </span>
              {message.authorEmail ? (
                <span className="truncate text-xs text-(--inbox-text-muted)">
                  {message.authorEmail}
                </span>
              ) : null}
            </p>
            {message.recipientEmail ? (
              <p className="truncate text-xs text-(--inbox-text-muted)">
                To: {message.recipientEmail}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <time className="text-xs text-(--inbox-text-muted)">
            {formatRelativeTime(message.sentAt)}
          </time>
          {onReply ? (
            <button
              type="button"
              aria-label="Reply to this email"
              title="Reply"
              onClick={onReply}
              className="-my-1.5 flex size-8 items-center justify-center rounded-lg text-(--inbox-text-subtle) outline-none transition-colors hover:bg-(--inbox-hover) hover:text-(--inbox-text) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
            >
              <Reply className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
      <p className="px-4 pt-3 pb-4 text-sm leading-5 break-words whitespace-pre-line text-(--inbox-text)">
        {message.body}
      </p>
    </article>
  );
}

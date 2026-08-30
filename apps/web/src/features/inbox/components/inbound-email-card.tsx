import type { Message } from "../types";
import { formatRelativeTime } from "../utils";
import { ConversationAvatar } from "./conversation-avatar";

/** Full-width white inbound email card from the mail-reply reference. */
export function InboundEmailCard({ message }: { message: Message }) {
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
        <time className="shrink-0 text-xs text-(--inbox-text-muted)">
          {formatRelativeTime(message.sentAt)}
        </time>
      </div>
      <p className="px-4 pt-3 pb-4 text-sm leading-5 break-words whitespace-pre-line text-(--inbox-text)">
        {message.body}
      </p>
    </article>
  );
}

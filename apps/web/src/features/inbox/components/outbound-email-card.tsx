import { CornerUpLeft } from "lucide-react";

import type { Message } from "../types";
import { formatRelativeTime } from "../utils";
import { ConversationAvatar } from "./conversation-avatar";

type OutboundEmailCardProps = {
  message: Message;
};

/**
 * Full-width email card for replies sent from Reply — same structure as the
 * inbound card (sender identity, To: line, body) so emails read as emails,
 * distinct from internal comments.
 */
export function OutboundEmailCard({ message }: OutboundEmailCardProps) {
  return (
    <article className="rounded-xl border border-(--inbox-border) bg-(--inbox-surface-elevated) shadow-(--inbox-shadow-card)">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="flex min-w-0 items-start gap-3">
          <ConversationAvatar
            name={message.authorName}
            imageUrl={message.authorImageUrl}
            imageFit="person"
          />
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
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="flex h-6 items-center gap-1 rounded-full bg-(--inbox-hover) px-2 text-xs font-medium tracking-[-0.1px] text-(--inbox-text-muted)"
            title="Reply you sent to the customer"
          >
            <CornerUpLeft className="size-3" aria-hidden />
            Sent reply
          </span>
          <time className="text-xs text-(--inbox-text-muted)">
            {formatRelativeTime(message.sentAt)}
          </time>
        </div>
      </div>
      {message.bodyHtml ? (
        /* Rich replies authored in the local composer (trusted Tiptap output). */
        <div
          className="inbox-rich-body px-4 pt-3 pb-4 text-sm leading-5 break-words text-(--inbox-text)"
          dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
        />
      ) : (
        <p className="px-4 pt-3 pb-4 text-sm leading-5 break-words whitespace-pre-line text-(--inbox-text)">
          {message.body}
        </p>
      )}
    </article>
  );
}

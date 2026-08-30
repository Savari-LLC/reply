import type { Message } from "../types";
import { formatRelativeTime } from "../utils";

type OutboundReplyBubbleProps = {
  message: Message;
  /** Show the sender line when the direction changes (mail-reply reference). */
  showSender: boolean;
};

/** Right-aligned teal reply bubble with an inline translucent time pill. */
export function OutboundReplyBubble({ message, showSender }: OutboundReplyBubbleProps) {
  return (
    <div className="flex flex-col items-end gap-1.5">
      {showSender ? (
        <p className="flex max-w-[65%] items-baseline gap-1.5">
          <span className="truncate text-sm font-semibold tracking-[-0.1px] text-(--inbox-text-strong)">
            {message.authorName}
          </span>
          {message.authorEmail ? (
            <span className="truncate text-xs text-(--inbox-text-muted)">
              via {message.authorEmail}
            </span>
          ) : null}
        </p>
      ) : null}
      <div className="max-w-[65%] rounded-xl bg-(--inbox-primary) px-4 py-3">
        <p className="text-sm leading-5 break-words whitespace-pre-line text-(--inbox-text-inverse)">
          {message.body}
          <time className="ml-2 inline-flex translate-y-px rounded-full bg-white/20 px-2 py-0.5 align-baseline text-xs whitespace-nowrap text-(--inbox-text-inverse)/90">
            {formatRelativeTime(message.sentAt)}
          </time>
        </p>
      </div>
    </div>
  );
}

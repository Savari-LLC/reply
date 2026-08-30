import { useEffect, useMemo, useRef } from "react";

import type { Message } from "../types";
import { formatDateSeparator } from "../utils";
import { InboundEmailCard } from "./inbound-email-card";
import { OutboundReplyBubble } from "./outbound-reply-bubble";

function isSameDay(a: number, b: number): boolean {
  const dateA = new Date(a);
  const dateB = new Date(b);
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

type MessageTimelineProps = {
  threadId: string;
  messages: Message[];
};

/** Independently scrollable message list with date-separator pills. */
export function MessageTimeline({ threadId, messages }: MessageTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const ordered = useMemo(() => [...messages].sort((a, b) => a.sentAt - b.sentAt), [messages]);

  // Pin to the newest message on thread change and after a successful send.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [threadId, ordered.length]);

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
      <ol className="flex flex-col gap-4">
        {ordered.map((message, index) => {
          const previous = ordered[index - 1];
          const newDay = !previous || !isSameDay(previous.sentAt, message.sentAt);
          const directionChanged = !previous || previous.direction !== message.direction;
          return (
            <li key={message.id} className="flex flex-col gap-4">
              {newDay && previous ? (
                <div className="flex justify-center">
                  <span className="rounded-full border border-(--inbox-border) bg-(--inbox-hover) px-3 py-1 text-xs font-medium text-(--inbox-text)">
                    {formatDateSeparator(message.sentAt)}
                  </span>
                </div>
              ) : null}
              {message.direction === "inbound" ? (
                <InboundEmailCard message={message} />
              ) : (
                <OutboundReplyBubble message={message} showSender={directionChanged} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

import { useEffect, useMemo, useRef } from "react";

import type { Message, ThreadComment } from "../types";
import { formatDateSeparator } from "../utils";
import { CommentGroup } from "./comment-group";
import { InboundEmailCard, type CompanyChip } from "./inbound-email-card";
import { OutboundEmailCard } from "./outbound-email-card";

function isSameDay(a: number, b: number): boolean {
  const dateA = new Date(a);
  const dateB = new Date(b);
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

/** One rendered row: an email, or a run of same-author internal comments. */
type TimelineEntry =
  | { kind: "message"; sentAt: number; message: Message }
  | { kind: "comments"; sentAt: number; comments: ThreadComment[] };

/**
 * Interleaves emails and internal comments by time, then merges consecutive
 * comments from the same author into one avatar-led group.
 */
function buildEntries(messages: Message[], comments: ThreadComment[]): TimelineEntry[] {
  const items: TimelineEntry[] = [
    ...messages.map((message) => ({ kind: "message" as const, sentAt: message.sentAt, message })),
    ...comments.map((comment) => ({
      kind: "comments" as const,
      sentAt: comment.sentAt,
      comments: [comment],
    })),
  ].sort((a, b) => a.sentAt - b.sentAt);

  const entries: TimelineEntry[] = [];
  for (const item of items) {
    const previous = entries[entries.length - 1];
    if (
      item.kind === "comments" &&
      previous?.kind === "comments" &&
      previous.comments[0]!.authorId === item.comments[0]!.authorId &&
      isSameDay(previous.sentAt, item.sentAt)
    ) {
      previous.comments.push(...item.comments);
      continue;
    }
    entries.push(item);
  }
  return entries;
}

type MessageTimelineProps = {
  threadId: string;
  messages: Message[];
  /** Internal comments, interleaved with messages by time. */
  comments?: ThreadComment[];
  /** Opens the full reply composer; rendered on the latest inbound message. */
  onReply?: () => void;
  /** Context.dev enrichment chip, rendered on the first inbound message. */
  companyChip?: CompanyChip;
};

/** Independently scrollable message list with date-separator pills. */
export function MessageTimeline({
  threadId,
  messages,
  comments = [],
  onReply,
  companyChip,
}: MessageTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const entries = useMemo(() => buildEntries(messages, comments), [messages, comments]);
  const lastInboundId = useMemo(
    () =>
      [...messages].sort((a, b) => b.sentAt - a.sentAt).find((m) => m.direction === "inbound")?.id,
    [messages],
  );
  const firstInboundId = useMemo(
    () =>
      [...messages].sort((a, b) => a.sentAt - b.sentAt).find((m) => m.direction === "inbound")?.id,
    [messages],
  );
  const itemCount = messages.length + comments.length;

  // Pin to the newest item on thread change and after a successful send.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [threadId, itemCount]);

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
      <ol className="flex flex-col gap-4">
        {entries.map((entry, index) => {
          const previous = entries[index - 1];
          const newDay = !previous || !isSameDay(previous.sentAt, entry.sentAt);
          const key =
            entry.kind === "message" ? entry.message.id : entry.comments[0]!.id;
          return (
            <li key={key} className="flex flex-col gap-4">
              {newDay && previous ? (
                <div className="flex justify-center">
                  <span className="rounded-full border border-(--inbox-border) bg-(--inbox-hover) px-3 py-1 text-xs font-medium text-(--inbox-text)">
                    {formatDateSeparator(entry.sentAt)}
                  </span>
                </div>
              ) : null}
              {entry.kind === "comments" ? (
                <CommentGroup comments={entry.comments} />
              ) : entry.message.direction === "inbound" ? (
                <InboundEmailCard
                  message={entry.message}
                  onReply={entry.message.id === lastInboundId ? onReply : undefined}
                  companyChip={entry.message.id === firstInboundId ? companyChip : undefined}
                />
              ) : (
                <OutboundEmailCard message={entry.message} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

import { FileText } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import type { CommentAttachment, ThreadComment } from "../types";
import { formatFileSize, formatRelativeTime } from "../utils";
import { ConversationAvatar } from "./conversation-avatar";

/** Wraps "@Name" tokens of confirmed mentions in a highlight span. */
function renderBody(comment: ThreadComment): ReactNode {
  const names = (comment.mentions ?? []).map((mention) => mention.name);
  if (names.length === 0) return comment.body;
  const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = comment.body.split(new RegExp(`(@(?:${escaped.join("|")}))`, "g"));
  return parts.map((part, index) =>
    part.startsWith("@") && names.includes(part.slice(1)) ? (
      <mark
        key={index}
        className="rounded bg-(--inbox-active) px-0.5 font-medium text-(--inbox-primary-text)"
      >
        {part}
      </mark>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

function AttachmentChip({ attachment }: { attachment: CommentAttachment }) {
  if (attachment.type.startsWith("image/")) {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer" className="block">
        <img
          src={attachment.url}
          alt={attachment.name}
          className="max-h-40 max-w-60 rounded-lg border border-(--inbox-border) object-cover"
        />
      </a>
    );
  }
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      download={attachment.name}
      className="flex items-center gap-2 rounded-lg border border-(--inbox-border) bg-(--inbox-surface-elevated) px-2.5 py-1.5 outline-none transition-colors hover:bg-(--inbox-hover) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
    >
      <span className="flex size-7 items-center justify-center rounded-md bg-(--inbox-hover)">
        <FileText className="size-3.5 text-(--inbox-text-subtle)" aria-hidden />
      </span>
      <span className="flex flex-col">
        <span className="max-w-40 truncate text-xs font-medium tracking-[-0.1px] text-(--inbox-text)">
          {attachment.name}
        </span>
        <span className="text-[11px] text-(--inbox-text-muted)">
          {formatFileSize(attachment.size)}
        </span>
      </span>
    </a>
  );
}

type CommentGroupProps = {
  /** Consecutive comments by the same author, oldest first. */
  comments: ThreadComment[];
};

/**
 * Left-aligned internal-comment group from the Missive reference: the
 * author's avatar and name once, then their consecutive comments stacked as
 * quiet bubbles. Never emailed to the customer.
 */
export function CommentGroup({ comments }: CommentGroupProps) {
  const first = comments[0];
  if (!first) return null;

  return (
    <section className="flex flex-col gap-1" aria-label={`Internal comments from ${first.authorName}`}>
      <p className="pl-11 text-xs font-semibold tracking-[-0.1px] text-(--inbox-text-strong)">
        {first.authorName}
        <span className="ml-1.5 font-normal text-(--inbox-text-muted)">Internal comment</span>
      </p>
      <ul className="flex flex-col gap-1">
        {comments.map((comment, index) => (
          <li key={comment.id} className="flex items-start gap-3">
            {index === 0 ? (
              <ConversationAvatar
                name={comment.authorName}
                imageUrl={comment.authorImageUrl}
                imageFit="person"
              />
            ) : (
              <span className="w-8 shrink-0" aria-hidden />
            )}
            <div className="flex max-w-[65%] flex-col gap-1.5">
              {comment.body ? (
                <p className="w-fit rounded-lg border border-(--inbox-border) bg-(--inbox-hover) px-3 py-1.5 text-sm leading-5 break-words whitespace-pre-line text-(--inbox-text)">
                  {renderBody(comment)}
                </p>
              ) : null}
              {comment.attachments && comment.attachments.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {comment.attachments.map((attachment, attachmentIndex) => (
                    <AttachmentChip key={attachmentIndex} attachment={attachment} />
                  ))}
                </div>
              ) : null}
            </div>
            <time className="ml-auto shrink-0 self-center text-xs text-(--inbox-text-muted)">
              {formatRelativeTime(comment.sentAt)}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
}

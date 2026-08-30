import { Spinner } from "@reply/ui/components/spinner";
import { Building2, ChevronRight, Sparkles } from "lucide-react";

import type { CompanyStatus, Message } from "../types";
import { formatRelativeTime } from "../utils";
import { ConversationAvatar } from "./conversation-avatar";

export type CompanyChip = {
  status: CompanyStatus;
  name?: string;
  logoUrl?: string;
  /** Opens the company context sidebar. */
  onOpen: () => void;
};

type InboundEmailCardProps = {
  message: Message;
  /** Renders the teal Reply button (latest inbound message) and opens the full composer. */
  onReply?: () => void;
  /**
   * Context.dev enrichment state, rendered on the first email of the thread
   * to show that the sender's company profile has been generated.
   */
  companyChip?: CompanyChip;
};

function CompanyChipBadge({ chip }: { chip: CompanyChip }) {
  if (chip.status === "unavailable") return null;
  if (chip.status === "loading") {
    return (
      <p
        className="flex h-7 items-center gap-1.5 rounded-full border border-(--inbox-border) bg-(--inbox-hover) px-2.5 text-xs font-medium text-(--inbox-text-muted)"
        aria-live="polite"
      >
        <Spinner className="size-3" />
        <span className="hidden sm:inline">Generating profile…</span>
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={chip.onOpen}
      className="group flex h-7 items-center gap-1.5 rounded-full border border-(--inbox-border) bg-(--inbox-surface) pr-2 pl-1 text-xs font-medium tracking-[-0.1px] text-(--inbox-text) outline-none transition-colors hover:bg-(--inbox-hover) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
    >
      {chip.logoUrl ? (
        <ConversationAvatar name={chip.name ?? "Company"} imageUrl={chip.logoUrl} size={20} />
      ) : (
        <span className="flex size-5 items-center justify-center rounded-full bg-(--inbox-active)">
          <Building2 className="size-3 text-(--inbox-text-subtle)" aria-hidden />
        </span>
      )}
      <span className="flex items-center gap-1 text-(--inbox-primary-text)">
        <Sparkles className="size-3" aria-hidden />
        <span className="hidden sm:inline">Profile ready</span>
      </span>
      <ChevronRight
        className="size-3.5 text-(--inbox-text-muted) transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
      <span className="sr-only">Open company details for {chip.name ?? "this company"}</span>
    </button>
  );
}

/** Full-width white inbound email card from the mail-reply reference. */
export function InboundEmailCard({ message, onReply, companyChip }: InboundEmailCardProps) {
  return (
    <article className="rounded-xl border border-(--inbox-border) bg-(--inbox-surface-elevated) shadow-(--inbox-shadow-card)">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="flex min-w-0 items-start gap-3">
          <ConversationAvatar
            name={message.authorName}
            imageUrl={companyChip?.status === "ready" ? companyChip.logoUrl : undefined}
            online
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
          {companyChip ? <CompanyChipBadge chip={companyChip} /> : null}
          <time className="text-xs text-(--inbox-text-muted)">
            {formatRelativeTime(message.sentAt)}
          </time>
        </div>
      </div>
      <p className="px-4 pt-3 pb-4 text-sm leading-5 break-words whitespace-pre-line text-(--inbox-text)">
        {message.body}
      </p>
      {onReply ? (
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={onReply}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-(--inbox-primary) px-4 text-sm font-medium tracking-[-0.1px] text-(--inbox-text-inverse) outline-none transition-colors hover:bg-(--inbox-primary)/90 focus-visible:ring-2 focus-visible:ring-(--inbox-primary) focus-visible:ring-offset-2"
          >
            Reply
          </button>
        </div>
      ) : null}
    </article>
  );
}

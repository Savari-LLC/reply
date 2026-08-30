import { Spinner } from "@reply/ui/components/spinner";
import { Textarea } from "@reply/ui/components/textarea";
import { Reply, Sparkles } from "lucide-react";
import { useRef, useState } from "react";

import type { OperationState } from "../types";

type ReplyComposerProps = {
  draftState: OperationState;
  sendState: OperationState;
  onGenerateDraft: () => Promise<string>;
  onSendReply: (body: string) => Promise<void>;
};

/**
 * Reduced ReplyFlow composer: editable textarea, Draft with Copilot, and Send.
 * Draft failures stay inline; send success/failure toasts come from the controller.
 */
export function ReplyComposer({
  draftState,
  sendState,
  onGenerateDraft,
  onSendReply,
}: ReplyComposerProps) {
  const [text, setText] = useState("");
  const [draftFailed, setDraftFailed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Local guards: the operations prop updates asynchronously, so rapid clicks
  // could otherwise double-fire before the disabled state lands.
  const draftingRef = useRef(false);
  const sendingRef = useRef(false);

  const drafting = draftState.status === "loading";
  const sending = sendState.status === "loading";

  const handleDraft = async () => {
    if (draftingRef.current) return;
    draftingRef.current = true;
    setDraftFailed(false);
    try {
      const draft = await onGenerateDraft();
      // Replace only an empty textarea; otherwise append after a blank line.
      setText((current) => (current.trim() ? `${current}\n\n${draft}` : draft));
    } catch {
      setDraftFailed(true);
    } finally {
      draftingRef.current = false;
    }
  };

  const handleSend = async () => {
    if (sendingRef.current || !text.trim()) return;
    sendingRef.current = true;
    try {
      await onSendReply(text);
      setText("");
    } catch {
      // Draft preserved; the controller toasts the error.
      textareaRef.current?.focus();
    } finally {
      sendingRef.current = false;
    }
  };

  return (
    <div className="p-4 pt-0">
      <div
        className="overflow-hidden rounded-xl border border-(--inbox-border) bg-(--inbox-surface-elevated) shadow-(--inbox-shadow-composer)"
        aria-busy={sending || drafting}
      >
        <div className="flex items-center gap-2 border-b border-(--inbox-border-subtle) bg-(--inbox-surface) px-4 py-2.5">
          <Reply className="size-4 text-(--inbox-text-subtle)" aria-hidden />
          <span className="text-sm font-medium tracking-[-0.1px] text-(--inbox-text)">Reply</span>
        </div>
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-label="Reply"
          placeholder="Write a reply…"
          className="max-h-64 min-h-24 rounded-none border-0 bg-transparent px-4 py-3 text-sm text-(--inbox-text) placeholder:text-(--inbox-text-muted) focus-visible:border-transparent focus-visible:ring-0 md:text-sm"
        />
        <div className="flex items-center justify-between gap-3 px-4 pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              disabled={drafting}
              onClick={handleDraft}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-(--inbox-border) bg-(--inbox-surface-elevated) px-2.5 text-sm tracking-[-0.1px] text-(--inbox-text) outline-none transition-colors hover:bg-(--inbox-hover) focus-visible:ring-2 focus-visible:ring-(--inbox-primary) disabled:pointer-events-none disabled:opacity-60"
            >
              {drafting ? (
                <>
                  <Spinner className="size-3.5" />
                  Drafting…
                </>
              ) : (
                <>
                  <Sparkles className="size-4 text-(--inbox-primary)" aria-hidden />
                  Draft with Copilot
                </>
              )}
            </button>
            {draftFailed && !drafting ? (
              <p role="alert" className="min-w-0 truncate text-xs text-destructive">
                Copilot could not draft a reply.{" "}
                <button
                  type="button"
                  onClick={handleDraft}
                  className="font-medium underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
                >
                  Retry
                </button>
              </p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={!text.trim() || sending}
            onClick={handleSend}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-(--inbox-primary) px-4 text-sm font-medium tracking-[-0.1px] text-(--inbox-text-inverse) outline-none transition-colors hover:bg-(--inbox-primary)/90 focus-visible:ring-2 focus-visible:ring-(--inbox-primary) focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
          >
            {sending ? <Spinner className="size-3.5" /> : null}
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

import "@react-email/editor/themes/default.css";

import { EmailEditor, type EmailEditorRef } from "@react-email/editor";
import { Spinner } from "@reply/ui/components/spinner";
import {
  ArrowLeft,
  AtSign,
  FileText,
  Maximize2,
  Paperclip,
  Smile,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { OperationState, ThreadSummary } from "../types";
import { ComposerToolbar } from "./composer-toolbar";

type ReplyComposerProps = {
  thread: ThreadSummary;
  draftState: OperationState;
  sendState: OperationState;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onGenerateDraft: (currentDraft?: string) => Promise<string>;
  onSendReply: (body: string, bodyHtml?: string) => Promise<void>;
};

type Attachment = { name: string; size: number };

const WORKSPACE_EMAIL = "hello@reply.dev";

const ICON_BUTTON =
  "flex size-8 shrink-0 items-center justify-center rounded-lg text-(--inbox-text-subtle) outline-none transition-colors hover:bg-(--inbox-hover) hover:text-(--inbox-text) focus-visible:ring-2 focus-visible:ring-(--inbox-primary) disabled:pointer-events-none disabled:opacity-40";

const SEND_BUTTON =
  "flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-(--inbox-primary) px-4 text-sm font-medium tracking-[-0.1px] text-(--inbox-text-inverse) outline-none transition-colors hover:bg-(--inbox-primary)/90 focus-visible:ring-2 focus-visible:ring-(--inbox-primary) focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60";

/** Escape plain text and convert paragraph/line breaks into editor HTML. */
function draftToHtml(draft: string): string {
  const escaped = draft
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replaceAll("\n", "<br>")}</p>`)
    .join("");
}

/** Fixture-only uploader: inlines the image as a data URL, no network. */
function readFileAsDataUrl(file: File): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ url: reader.result as string });
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Two-mode ReplyFlow composer. Collapsed: a plain text field with Send.
 * Expanded (via a Reply action): the full Figma composer — From/To/Subject
 * fields, formatting toolbar, rich text with inline images, attachments,
 * Draft with Copilot, and Send. Toasts come from the controller.
 */
export function ReplyComposer({
  thread,
  draftState,
  sendState,
  expanded,
  onExpandedChange,
  onGenerateDraft,
  onSendReply,
}: ReplyComposerProps) {
  const editorRef = useRef<EmailEditorRef>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const collapsedRef = useRef<HTMLTextAreaElement>(null);

  const [plainText, setPlainText] = useState("");
  const [richEmpty, setRichEmpty] = useState(true);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [tall, setTall] = useState(false);
  const [draftFailed, setDraftFailed] = useState(false);
  // Tiptap cannot render during SSR; mount the editor client-side only.
  const [mounted, setMounted] = useState(false);
  // Local guards against double-fire before the async operation state lands.
  const draftingRef = useRef(false);
  const sendingRef = useRef(false);
  // Editor identity per expansion so `content` re-seeds from collapsed text.
  const [editorEpoch, setEditorEpoch] = useState(0);

  useEffect(() => setMounted(true), []);

  const drafting = draftState.status === "loading";
  const sending = sendState.status === "loading";
  const editor = editorRef.current?.editor ?? null;

  const expand = () => {
    setEditorEpoch((epoch) => epoch + 1);
    setRichEmpty(!plainText.trim());
    onExpandedChange(true);
  };

  const collapse = async () => {
    const text = (await editorRef.current?.getEmailText())?.trim();
    if (text) setPlainText(text);
    onExpandedChange(false);
    setDraftFailed(false);
  };

  const handleDraft = async () => {
    if (draftingRef.current) return;
    draftingRef.current = true;
    setDraftFailed(false);
    try {
      // Copilot reads the operator's in-progress text and returns the full
      // refined reply, so the result replaces the editor contents.
      const currentDraft = (await editorRef.current?.getEmailText())?.trim();
      const draft = await onGenerateDraft(currentDraft || undefined);
      const target = editorRef.current?.editor;
      if (target) {
        target.commands.setContent(draftToHtml(draft));
        target.commands.focus("end");
        setRichEmpty(false);
      }
    } catch {
      setDraftFailed(true);
    } finally {
      draftingRef.current = false;
    }
  };

  const handleSendRich = async () => {
    if (sendingRef.current || !editorRef.current) return;
    const { html, text } = await editorRef.current.getEmail();
    if (!text.trim()) return;
    sendingRef.current = true;
    try {
      await onSendReply(text, html);
      editorRef.current.editor?.commands.clearContent(true);
      setAttachments([]);
      setPlainText("");
      onExpandedChange(false);
    } catch {
      // Draft preserved; the controller toasts the error.
      editorRef.current.editor?.commands.focus("end");
    } finally {
      sendingRef.current = false;
    }
  };

  const handleSendPlain = async () => {
    if (sendingRef.current || !plainText.trim()) return;
    sendingRef.current = true;
    try {
      await onSendReply(plainText);
      setPlainText("");
    } catch {
      collapsedRef.current?.focus();
    } finally {
      sendingRef.current = false;
    }
  };

  const handleInsertImage = () => imageInputRef.current?.click();

  const onImagePicked = async (file: File | undefined) => {
    const target = editorRef.current?.editor;
    if (!file || !target) return;
    const { url } = await readFileAsDataUrl(file);
    target.chain().focus().insertContent(`<img src="${url}" alt="${file.name}">`).run();
    setRichEmpty(false);
  };

  const onAttachmentsPicked = (files: FileList | null) => {
    if (!files?.length) return;
    setAttachments((current) => [
      ...current,
      ...Array.from(files).map((file) => ({ name: file.name, size: file.size })),
    ]);
  };

  if (!expanded) {
    return (
      <div className="p-4 pt-0">
        <div className="rounded-xl border border-(--inbox-border) bg-(--inbox-surface-elevated) shadow-(--inbox-shadow-composer)">
          <textarea
            ref={collapsedRef}
            value={plainText}
            onChange={(event) => setPlainText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "/" && !plainText) {
                event.preventDefault();
                expand();
              }
            }}
            rows={1}
            aria-label="Reply"
            placeholder='Write, or press "/" for commands...'
            className="max-h-40 min-h-11 w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-sm leading-5 tracking-[-0.1px] text-(--inbox-text) outline-none placeholder:text-(--inbox-text-muted)"
          />
          <div className="flex items-center justify-between gap-3 px-3 pb-2.5">
            <div className="flex items-center gap-0.5">
              <button type="button" aria-label="Open full composer to attach files" onClick={expand} className={ICON_BUTTON}>
                <Paperclip className="size-4" aria-hidden />
              </button>
              <button type="button" aria-label="Open full composer to mention" onClick={expand} className={ICON_BUTTON}>
                <AtSign className="size-4" aria-hidden />
              </button>
              <button type="button" aria-label="Open full composer" onClick={expand} className={ICON_BUTTON}>
                <Smile className="size-4" aria-hidden />
              </button>
            </div>
            <button
              type="button"
              disabled={!plainText.trim() || sending}
              onClick={handleSendPlain}
              className={SEND_BUTTON}
            >
              {sending ? <Spinner className="size-3.5" /> : null}
              Send
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pt-0">
      <div
        className="overflow-hidden rounded-xl border border-(--inbox-border) bg-(--inbox-surface-elevated) shadow-(--inbox-shadow-composer)"
        aria-busy={sending || drafting}
      >
        {/* Topbar */}
        <div className="flex items-center gap-2 bg-(--inbox-surface) px-4 py-2.5">
          <button type="button" aria-label="Collapse composer" onClick={collapse} className="-ml-1.5 flex size-6 items-center justify-center rounded-lg text-(--inbox-text) outline-none hover:bg-(--inbox-hover) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)">
            <ArrowLeft className="size-4" aria-hidden />
          </button>
          <span className="text-sm font-medium tracking-[-0.1px] text-(--inbox-text)">Reply</span>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              aria-label={tall ? "Reduce composer height" : "Expand composer height"}
              aria-pressed={tall}
              onClick={() => setTall((value) => !value)}
              className="flex size-6 items-center justify-center rounded-lg text-(--inbox-text-subtle) outline-none hover:bg-(--inbox-hover) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
            >
              <Maximize2 className="size-4" aria-hidden />
            </button>
            <button type="button" aria-label="Close composer" onClick={collapse} className="flex size-6 items-center justify-center rounded-lg text-(--inbox-text-subtle) outline-none hover:bg-(--inbox-hover) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        {/* Address fields */}
        <div className="flex flex-col gap-2 border-y border-(--inbox-border-subtle) px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="text-sm text-(--inbox-text-muted)">From:</span>
            <span className="rounded-full bg-[#d6ecff] px-2 py-0.5 text-xs font-medium tracking-[-0.1px] text-[#0e43a0]">
              {WORKSPACE_EMAIL}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-sm text-(--inbox-text-muted)">To:</span>
            <span className="rounded-full bg-(--inbox-hover) px-2 py-0.5 text-xs font-medium tracking-[-0.1px] text-(--inbox-text-strong)">
              {thread.customerName}
            </span>
            <span className="ml-auto flex gap-3 text-sm text-(--inbox-text-muted)" aria-hidden>
              <span>Cc</span>
              <span>Bcc</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2.5 border-b border-(--inbox-border-subtle) px-4 py-3">
          <span className="text-sm text-(--inbox-text-muted)">Subject:</span>
          <span className="min-w-0 truncate text-sm font-medium tracking-[-0.1px] text-(--inbox-text-strong)">
            {thread.subject.startsWith("Re:") ? thread.subject : `Re: ${thread.subject}`}
          </span>
        </div>

        <ComposerToolbar editor={editor} onInsertImage={handleInsertImage} />

        <div className={`inbox-composer-editor ${tall ? "inbox-composer-editor-tall" : ""}`} aria-label="Reply">
          {mounted ? (
            <EmailEditor
              key={editorEpoch}
              ref={editorRef}
              content={plainText.trim() ? draftToHtml(plainText) : undefined}
              placeholder="Write a reply…"
              theme="basic"
              onReady={(ref) => {
                setRichEmpty(ref.editor?.isEmpty ?? true);
                ref.editor?.commands.focus("end");
              }}
              onUpdate={(ref) => setRichEmpty(ref.editor?.isEmpty ?? true)}
              onUploadImage={readFileAsDataUrl}
            />
          ) : (
            <p className="px-4 py-3 text-sm text-(--inbox-text-muted)">Write a reply…</p>
          )}
        </div>

        {attachments.length > 0 ? (
          <ul className="flex flex-wrap gap-2 px-4 pb-2" aria-label="Attachments">
            {attachments.map((attachment, index) => (
              <li
                key={`${attachment.name}-${index}`}
                className="flex items-center gap-2 rounded-lg border border-(--inbox-border) px-2.5 py-1.5"
              >
                <span className="flex size-7 items-center justify-center rounded-md bg-(--inbox-hover)">
                  <FileText className="size-3.5 text-(--inbox-text-subtle)" aria-hidden />
                </span>
                <span className="flex flex-col">
                  <span className="max-w-28 truncate text-xs font-medium tracking-[-0.1px] text-(--inbox-text)">
                    {attachment.name}
                  </span>
                  <span className="text-[11px] text-(--inbox-text-muted)">
                    {formatFileSize(attachment.size)}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${attachment.name}`}
                  onClick={() => setAttachments((current) => current.filter((_, i) => i !== index))}
                  className="ml-1 flex size-5 items-center justify-center rounded text-(--inbox-text-muted) outline-none hover:bg-(--inbox-hover) hover:text-(--inbox-text) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {/* Bottom actions */}
        <div className="flex items-center gap-1 px-3 pb-3">
          <button
            type="button"
            disabled={drafting}
            onClick={handleDraft}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-medium tracking-[-0.1px] text-(--inbox-primary-text) outline-none transition-colors hover:bg-(--inbox-hover) focus-visible:ring-2 focus-visible:ring-(--inbox-primary) disabled:pointer-events-none disabled:opacity-60"
          >
            {drafting ? (
              <>
                <Spinner className="size-3.5" />
                Drafting…
              </>
            ) : (
              <>
                <Sparkles className="size-4" aria-hidden />
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
          <span className="mx-1 h-4 w-px shrink-0 bg-(--inbox-border)" aria-hidden />
          <button type="button" aria-label="Attach files" onClick={() => attachmentInputRef.current?.click()} className={ICON_BUTTON}>
            <Paperclip className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Mention someone"
            onClick={() => editor?.chain().focus().insertContent("@").run()}
            className={ICON_BUTTON}
          >
            <AtSign className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Insert emoji"
            onClick={() => editor?.chain().focus().insertContent("🙂").run()}
            className={ICON_BUTTON}
          >
            <Smile className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Discard reply"
            onClick={() => {
              editor?.commands.clearContent(true);
              setAttachments([]);
              setRichEmpty(true);
            }}
            className={ICON_BUTTON}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            disabled={richEmpty || sending || !mounted}
            onClick={handleSendRich}
            className={`${SEND_BUTTON} ml-auto`}
          >
            {sending ? <Spinner className="size-3.5" /> : null}
            Send
          </button>
        </div>

        <input
          ref={attachmentInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            onAttachmentsPicked(event.target.files);
            event.target.value = "";
          }}
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            void onImagePicked(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

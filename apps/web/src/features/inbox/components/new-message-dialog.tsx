import "@react-email/editor/themes/default.css";

import { EmailEditor, type EmailEditorRef } from "@react-email/editor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@reply/ui/components/dialog";
import { AtSign, FileText, Maximize2, Paperclip, Smile, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";

import { ComposerToolbar } from "./composer-toolbar";

type NewMessageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Attachment = { name: string; size: number };

const WORKSPACE_EMAIL = "hello@reply.dev";

const ICON_BUTTON =
  "flex size-8 shrink-0 items-center justify-center rounded-lg text-(--inbox-text-subtle) outline-none transition-colors hover:bg-(--inbox-hover) hover:text-(--inbox-text) focus-visible:ring-2 focus-visible:ring-(--inbox-primary) disabled:pointer-events-none disabled:opacity-40";

const SEND_BUTTON =
  "flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-(--inbox-primary) px-4 text-sm font-medium tracking-[-0.1px] text-(--inbox-text-inverse) outline-none transition-colors hover:bg-(--inbox-primary)/90 focus-visible:ring-2 focus-visible:ring-(--inbox-primary) focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60";

const FIELD_INPUT =
  "h-6 min-w-24 flex-1 bg-transparent text-sm tracking-[-0.1px] text-(--inbox-text-strong) outline-none placeholder:text-(--inbox-text-muted)";

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

function formatFileSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Removable recipient chip, styled like the reply composer address pills. */
function RecipientChip({ email, onRemove }: { email: string; onRemove: () => void }) {
  return (
    <span className="flex max-w-full items-center gap-1 rounded-full bg-(--inbox-hover) py-0.5 pr-1 pl-2 text-xs font-medium tracking-[-0.1px] text-(--inbox-text-strong)">
      <span className="truncate">{email}</span>
      <button
        type="button"
        aria-label={`Remove ${email}`}
        onClick={onRemove}
        className="flex size-4 shrink-0 items-center justify-center rounded-full text-(--inbox-text-muted) outline-none hover:bg-(--inbox-active) hover:text-(--inbox-text) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
      >
        <X className="size-3" aria-hidden />
      </button>
    </span>
  );
}

/**
 * Address row that turns typed emails into removable chips on Enter, comma,
 * or blur. Backspace in an empty input removes the last chip.
 */
function RecipientField({
  id,
  label,
  recipients,
  onRecipientsChange,
  trailing,
}: {
  id: string;
  label: string;
  recipients: string[];
  onRecipientsChange: (recipients: string[]) => void;
  trailing?: React.ReactNode;
}) {
  const [draft, setDraft] = useState("");

  const commitDraft = () => {
    const value = draft.trim().replace(/,$/, "");
    if (!value) return;
    if (!isEmail(value)) return; // keep invalid text in the input for editing
    if (!recipients.includes(value)) onRecipientsChange([...recipients, value]);
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitDraft();
    } else if (event.key === "Backspace" && !draft && recipients.length > 0) {
      onRecipientsChange(recipients.slice(0, -1));
    }
  };

  return (
    <div className="flex min-h-8 items-center gap-2.5 px-4 py-1">
      <label htmlFor={id} className="w-14 shrink-0 text-sm text-(--inbox-text-muted)">
        {label}
      </label>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {recipients.map((email) => (
          <RecipientChip
            key={email}
            email={email}
            onRemove={() => onRecipientsChange(recipients.filter((entry) => entry !== email))}
          />
        ))}
        <input
          id={id}
          type="email"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commitDraft}
          placeholder={recipients.length === 0 ? "name@company.com" : undefined}
          autoComplete="off"
          className={FIELD_INPUT}
        />
      </div>
      {trailing}
    </div>
  );
}

/**
 * "New Message" composer in a dialog. The UI mirrors the expanded reply
 * composer; sending is not wired up yet (a teammate will integrate it).
 */
export function NewMessageDialog({ open, onOpenChange }: NewMessageDialogProps) {
  const editorRef = useRef<EmailEditorRef>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [richEmpty, setRichEmpty] = useState(true);
  const [tall, setTall] = useState(false);
  // Tiptap cannot render during SSR; mount the editor client-side only.
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Reset the form whenever the dialog opens so a cancelled draft never sticks.
  useEffect(() => {
    if (!open) return;
    setTo([]);
    setCc([]);
    setBcc([]);
    setShowCc(false);
    setShowBcc(false);
    setSubject("");
    setAttachments([]);
    setRichEmpty(true);
    setTall(false);
  }, [open]);

  const editor = editorRef.current?.editor ?? null;

  const handleInsertImage = () => imageInputRef.current?.click();

  const onImagePicked = (file: File | undefined) => {
    const target = editorRef.current?.editor;
    if (!file || !target) return;
    const reader = new FileReader();
    reader.onload = () => {
      target
        .chain()
        .focus()
        .insertContent(`<img src="${reader.result as string}" alt="${file.name}">`)
        .run();
      setRichEmpty(false);
    };
    reader.readAsDataURL(file);
  };

  const onAttachmentsPicked = (files: FileList | null) => {
    if (!files?.length) return;
    setAttachments((current) => [
      ...current,
      ...Array.from(files).map((file) => ({ name: file.name, size: file.size })),
    ]);
  };

  const handleDiscard = () => {
    editor?.commands.clearContent(true);
    setAttachments([]);
    setRichEmpty(true);
  };

  const handleSend = () => {
    // Dummy for now: a teammate will wire this to the backend.
    toast.info("Sending new messages is coming soon", {
      description: "This composer is UI-only for now — your draft stays here.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-xl border-(--inbox-border) p-0 sm:max-w-2xl">
        {/* Topbar */}
        <div className="flex items-center gap-2 bg-(--inbox-surface) py-2.5 pr-12 pl-4">
          <DialogTitle className="text-sm font-medium tracking-[-0.1px] text-(--inbox-text)">
            New message
          </DialogTitle>
          <DialogDescription className="sr-only">
            Compose a new outbound email from your workspace address.
          </DialogDescription>
          <button
            type="button"
            aria-label={tall ? "Reduce composer height" : "Expand composer height"}
            aria-pressed={tall}
            onClick={() => setTall((value) => !value)}
            className="ml-auto flex size-6 items-center justify-center rounded-lg text-(--inbox-text-subtle) outline-none hover:bg-(--inbox-hover) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
          >
            <Maximize2 className="size-4" aria-hidden />
          </button>
        </div>

        {/* Address fields */}
        <div className="flex flex-col border-y border-(--inbox-border-subtle) py-2">
          <div className="flex min-h-8 items-center gap-2.5 px-4 py-1">
            <span className="w-14 shrink-0 text-sm text-(--inbox-text-muted)">From:</span>
            <span className="rounded-full bg-[#d6ecff] px-2 py-0.5 text-xs font-medium tracking-[-0.1px] text-[#0e43a0]">
              {WORKSPACE_EMAIL}
            </span>
          </div>
          <RecipientField
            id="new-message-to"
            label="To:"
            recipients={to}
            onRecipientsChange={setTo}
            trailing={
              <span className="ml-auto flex shrink-0 gap-1">
                {!showCc ? (
                  <button
                    type="button"
                    onClick={() => setShowCc(true)}
                    className="rounded px-1 text-sm text-(--inbox-text-muted) outline-none hover:text-(--inbox-text) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
                  >
                    Cc
                  </button>
                ) : null}
                {!showBcc ? (
                  <button
                    type="button"
                    onClick={() => setShowBcc(true)}
                    className="rounded px-1 text-sm text-(--inbox-text-muted) outline-none hover:text-(--inbox-text) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
                  >
                    Bcc
                  </button>
                ) : null}
              </span>
            }
          />
          {showCc ? (
            <RecipientField id="new-message-cc" label="Cc:" recipients={cc} onRecipientsChange={setCc} />
          ) : null}
          {showBcc ? (
            <RecipientField id="new-message-bcc" label="Bcc:" recipients={bcc} onRecipientsChange={setBcc} />
          ) : null}
          <div className="flex min-h-8 items-center gap-2.5 border-t border-(--inbox-border-subtle) px-4 pt-2 pb-0.5">
            <label htmlFor="new-message-subject" className="w-14 shrink-0 text-sm text-(--inbox-text-muted)">
              Subject:
            </label>
            <input
              id="new-message-subject"
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="What is this about?"
              autoComplete="off"
              className={`${FIELD_INPUT} font-medium placeholder:font-normal`}
            />
          </div>
        </div>

        <ComposerToolbar editor={editor} onInsertImage={handleInsertImage} />

        <div
          className={`inbox-composer-editor ${tall ? "inbox-composer-editor-tall" : ""}`}
          aria-label="Message body"
        >
          {mounted && open ? (
            <EmailEditor
              ref={editorRef}
              placeholder="Write your message…"
              theme="basic"
              onReady={(ref) => {
                setRichEmpty(ref.editor?.isEmpty ?? true);
                ref.editor?.commands.focus("end");
              }}
              onUpdate={(ref) => setRichEmpty(ref.editor?.isEmpty ?? true)}
            />
          ) : (
            <p className="px-4 py-3 text-sm text-(--inbox-text-muted)">Write your message…</p>
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
        <div className="flex items-center gap-1 border-t border-(--inbox-border-subtle) px-3 py-2.5">
          <button
            type="button"
            aria-label="Attach files"
            onClick={() => attachmentInputRef.current?.click()}
            className={ICON_BUTTON}
          >
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
          <button type="button" aria-label="Discard message" onClick={handleDiscard} className={ICON_BUTTON}>
            <Trash2 className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            disabled={richEmpty || to.length === 0 || !mounted}
            onClick={handleSend}
            className={`${SEND_BUTTON} ml-auto`}
          >
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
            onImagePicked(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

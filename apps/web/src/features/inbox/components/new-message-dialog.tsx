import "@react-email/editor/themes/default.css";

import { EmailEditor, type EmailEditorRef } from "@react-email/editor";
import { api } from "@reply/backend/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@reply/ui/components/dialog";
import { Spinner } from "@reply/ui/components/spinner";
import { useAction, useQuery } from "convex/react";
import { AtSign, Maximize2, Paperclip, Smile, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";

import { ComposerToolbar } from "./composer-toolbar";

type NewMessageDialogProps = {
  open: boolean;
  liveEmail: boolean;
  onOpenChange: (open: boolean) => void;
};

const WORKSPACE_EMAIL = "hello@reply.dev";

const ICON_BUTTON =
  "flex size-8 shrink-0 items-center justify-center rounded-lg text-(--inbox-text-subtle) outline-none transition-colors hover:bg-(--inbox-hover) hover:text-(--inbox-text) focus-visible:ring-2 focus-visible:ring-(--inbox-primary) disabled:pointer-events-none disabled:opacity-40";

const SEND_BUTTON =
  "flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-(--inbox-primary) px-4 text-sm font-medium tracking-[-0.1px] text-(--inbox-text-inverse) outline-none transition-colors hover:bg-(--inbox-primary)/90 focus-visible:ring-2 focus-visible:ring-(--inbox-primary) focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60";

const FIELD_INPUT =
  "h-6 min-w-24 flex-1 bg-transparent text-sm tracking-[-0.1px] text-(--inbox-text-strong) outline-none placeholder:text-(--inbox-text-muted)";

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

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
  const [invalid, setInvalid] = useState(false);

  const commitDraft = () => {
    const value = draft.trim().replace(/,$/, "").toLowerCase();
    if (!value) {
      setInvalid(false);
      return;
    }
    if (!isEmail(value)) {
      setInvalid(true);
      return;
    }
    if (!recipients.includes(value)) onRecipientsChange([...recipients, value]);
    setDraft("");
    setInvalid(false);
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
          maxLength={254}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(false);
          }}
          onKeyDown={onKeyDown}
          onBlur={commitDraft}
          placeholder={recipients.length === 0 ? "name@company.com" : undefined}
          autoComplete="off"
          className={FIELD_INPUT}
        />
        {invalid ? (
          <span id={`${id}-error`} role="alert" className="w-full text-xs text-destructive">
            Enter a valid email address.
          </span>
        ) : null}
      </div>
      {trailing}
    </div>
  );
}

/**
 * "New Message" composer in a dialog. The UI mirrors the expanded reply
 * composer and queues authenticated live-workspace delivery through Resend.
 */
export function NewMessageDialog({ open, liveEmail, onOpenChange }: NewMessageDialogProps) {
  const editorRef = useRef<EmailEditorRef>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(false);
  const sendMessage = useAction(api.outboundEmail.send);
  const composerConfig = useQuery(api.outboundEmail.getComposerConfig, liveEmail ? {} : "skip");

  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState("");
  const [richEmpty, setRichEmpty] = useState(true);
  const [tall, setTall] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
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
    setRichEmpty(true);
    setTall(false);
    setSending(false);
    setSendError(null);
    sendingRef.current = false;
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

  const handleDiscard = () => {
    editor?.commands.clearContent(true);
    setRichEmpty(true);
    setSendError(null);
  };

  const handleSend = async () => {
    if (sendingRef.current || !editorRef.current) return;
    if (!liveEmail) {
      toast.info("New messages need a live workspace", {
        description: "Sign in to queue an email for delivery.",
      });
      return;
    }
    if (composerConfig?.configured !== true) return;

    sendingRef.current = true;
    setSending(true);
    setSendError(null);
    try {
      const { html, text } = await editorRef.current.getEmail();
      await sendMessage({
        to,
        cc,
        bcc,
        subject,
        text,
        ...(html.trim() ? { html } : {}),
      });
      editorRef.current.editor?.commands.clearContent(true);
      toast.success("Message queued", {
        description: "Your email was handed off for delivery.",
      });
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Your message could not be queued.";
      setSendError(message);
      toast.error("Your message was not sent", {
        description: `${message} Your draft is preserved.`,
      });
      editorRef.current?.editor?.commands.focus("end");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const senderEmail = liveEmail ? (composerConfig?.from || "Loading sender…") : WORKSPACE_EMAIL;
  const configurationError =
    liveEmail && composerConfig !== undefined && !composerConfig.configured
      ? "Email delivery is not configured for this workspace."
      : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!sendingRef.current) onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        aria-busy={sending}
        className="gap-0 overflow-hidden rounded-xl border-(--inbox-border) p-0 sm:max-w-2xl"
      >
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
          <div
            role="group"
            aria-labelledby="new-message-from-label"
            className="flex min-h-8 items-center gap-2.5 px-4 py-1"
          >
            <span id="new-message-from-label" className="w-14 shrink-0 text-sm text-(--inbox-text-muted)">
              From:
            </span>
            <span className="rounded-full bg-[#d6ecff] px-2 py-0.5 text-xs font-medium tracking-[-0.1px] text-[#0e43a0]">
              {senderEmail}
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
              maxLength={200}
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

        {/* Bottom actions */}
        <div className="flex items-center gap-1 border-t border-(--inbox-border-subtle) px-3 py-2.5">
          <button
            type="button"
            disabled
            aria-label="Attachments are not supported yet"
            title="Attachments are not supported yet"
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
          {configurationError || sendError ? (
            <p role="alert" className="ml-2 max-w-64 truncate text-xs text-destructive">
              {configurationError ?? sendError}
            </p>
          ) : null}
          <button
            type="button"
            disabled={
              richEmpty ||
              to.length === 0 ||
              !subject.trim() ||
              !mounted ||
              sending ||
              (liveEmail && composerConfig?.configured !== true)
            }
            onClick={() => void handleSend()}
            className={`${SEND_BUTTON} ml-auto`}
          >
            {sending ? <Spinner className="size-3.5" /> : null}
            {sending ? "Queueing…" : "Send"}
          </button>
        </div>
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

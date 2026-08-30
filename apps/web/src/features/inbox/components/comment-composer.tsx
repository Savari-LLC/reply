import { Popover, PopoverContent, PopoverTrigger } from "@reply/ui/components/popover";
import { Spinner } from "@reply/ui/components/spinner";
import { AtSign, FileText, Paperclip, Reply, Smile, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import type { CommentDraft, Teammate } from "../types";
import { formatFileSize } from "../utils";
import { ConversationAvatar } from "./conversation-avatar";

const MAX_FILES = 5;

const ICON_BUTTON =
  "flex size-8 shrink-0 items-center justify-center rounded-lg text-(--inbox-text-subtle) outline-none transition-colors hover:bg-(--inbox-hover) hover:text-(--inbox-text) focus-visible:ring-2 focus-visible:ring-(--inbox-primary) disabled:pointer-events-none disabled:opacity-40";

const SUBMIT_BUTTON =
  "flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-(--inbox-primary) px-4 text-sm font-medium tracking-[-0.1px] text-(--inbox-text-inverse) outline-none transition-colors hover:bg-(--inbox-primary)/90 focus-visible:ring-2 focus-visible:ring-(--inbox-primary) focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60";

/** Common emoji, grouped loosely; enough for internal comments. */
const EMOJI = [
  "😀", "😄", "😂", "🤣", "😊", "😉", "😍", "🤩",
  "😅", "🙃", "😐", "🤔", "🫡", "😴", "🤯", "😬",
  "😢", "😭", "😤", "😱", "🥳", "🤝", "👀", "🙏",
  "👍", "👎", "👌", "✌️", "🤞", "💪", "👏", "🙌",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🔥", "✨",
  "⭐", "🎉", "🎯", "🚀", "💡", "✅", "❌", "⚠️",
  "📌", "📎", "📅", "⏰", "💬", "📣", "🔍", "🛠️",
  "☕", "🍕", "🎂", "🌟", "💯", "🤖", "🐛", "🏁",
] as const;

/**
 * Finds the "@query" the caret is inside, if any: the last "@" before the
 * caret that starts a word, with no newline between it and the caret.
 */
function activeMentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const upToCaret = text.slice(0, caret);
  const at = upToCaret.lastIndexOf("@");
  if (at === -1) return null;
  if (at > 0 && !/\s/.test(upToCaret[at - 1]!)) return null;
  const query = upToCaret.slice(at + 1);
  if (query.includes("\n") || query.length > 40) return null;
  return { start: at, query };
}

type CommentComposerProps = {
  teammates: Teammate[];
  /** Draft text is owned by the parent so "/" can expand into a reply. */
  value: string;
  onChange: (value: string) => void;
  posting: boolean;
  /** Opens the full email composer (Reply button, "/" shortcut, rich actions). */
  onExpand: () => void;
  onSubmit: (draft: CommentDraft) => Promise<void>;
};

/**
 * Missive-style internal comment box: plain text with @-mentions of
 * teammates, file attachments, and an emoji picker. Never emails the
 * customer — everything posted here stays on the private timeline.
 */
export function CommentComposer({
  teammates,
  value,
  onChange,
  posting,
  onExpand,
  onSubmit,
}: CommentComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);

  const [caret, setCaret] = useState(0);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  // Every teammate picked from the popover; filtered against the final text
  // on submit so deleted "@Name" tokens don't produce ghost mentions.
  const pickedMentions = useRef<Map<string, string>>(new Map());

  const mention = mentionOpen ? activeMentionQuery(value, caret) : null;
  const suggestions = useMemo(() => {
    if (!mention) return [];
    const query = mention.query.trim().toLowerCase();
    return teammates.filter((teammate) => teammate.name.toLowerCase().includes(query));
  }, [mention, teammates]);
  const showSuggestions = mention !== null && suggestions.length > 0;

  const syncCaret = () => {
    const node = textareaRef.current;
    if (node) setCaret(node.selectionStart ?? 0);
  };

  const insertAtCaret = (snippet: string, replaceFrom?: number) => {
    const node = textareaRef.current;
    const start = replaceFrom ?? node?.selectionStart ?? value.length;
    const end = node?.selectionStart ?? value.length;
    const next = value.slice(0, start) + snippet + value.slice(end);
    onChange(next);
    // Restore focus and place the caret after the inserted snippet.
    requestAnimationFrame(() => {
      const target = textareaRef.current;
      if (!target) return;
      target.focus();
      const position = start + snippet.length;
      target.setSelectionRange(position, position);
      setCaret(position);
    });
  };

  const pickMention = (teammate: Teammate) => {
    if (!mention) return;
    pickedMentions.current.set(teammate.id, teammate.name);
    insertAtCaret(`@${teammate.name} `, mention.start);
    setMentionOpen(false);
    setActiveIndex(0);
  };

  const addFiles = (picked: FileList | null) => {
    if (!picked?.length) return;
    setFiles((current) => [...current, ...Array.from(picked)].slice(0, MAX_FILES));
  };

  const submit = async () => {
    if (submittingRef.current || (!value.trim() && files.length === 0)) return;
    submittingRef.current = true;
    try {
      const mentionedUserIds = [...pickedMentions.current.entries()]
        .filter(([, name]) => value.includes(`@${name}`))
        .map(([id]) => id);
      await onSubmit({ body: value, mentionedUserIds, files });
      onChange("");
      setFiles([]);
      pickedMentions.current.clear();
    } catch {
      textareaRef.current?.focus();
    } finally {
      submittingRef.current = false;
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((index) => (index + delta + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        pickMention(suggestions[activeIndex] ?? suggestions[0]!);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMentionOpen(false);
        return;
      }
    }
    if (event.key === "/" && !value) {
      event.preventDefault();
      onExpand();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <div className="relative rounded-xl border border-(--inbox-border) bg-(--inbox-surface-elevated) shadow-(--inbox-shadow-composer)">
      {showSuggestions ? (
        <ul
          role="listbox"
          aria-label="Mention a teammate"
          className="absolute bottom-full left-3 z-10 mb-1.5 max-h-56 w-64 overflow-y-auto rounded-lg border border-(--inbox-border) bg-(--inbox-surface-elevated) p-1 shadow-lg shadow-black/5"
        >
          {suggestions.map((teammate, index) => (
            <li key={teammate.id} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                onMouseDown={(event) => {
                  // Before blur so the textarea keeps focus.
                  event.preventDefault();
                  pickMention(teammate);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-(--inbox-text) ${
                  index === activeIndex ? "bg-(--inbox-hover)" : ""
                }`}
              >
                <ConversationAvatar
                  name={teammate.name}
                  imageUrl={teammate.avatarUrl}
                  imageFit="person"
                  size={24}
                />
                <span className="truncate">{teammate.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setCaret(event.target.selectionStart ?? 0);
          setMentionOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={handleKeyDown}
        onClick={syncCaret}
        onKeyUp={syncCaret}
        onBlur={() => setMentionOpen(false)}
        rows={1}
        aria-label="Internal comment"
        placeholder="Add internal comment — visible to your team only…"
        className="max-h-40 min-h-11 w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-sm leading-5 tracking-[-0.1px] text-(--inbox-text) outline-none placeholder:text-(--inbox-text-muted)"
      />

      {files.length > 0 ? (
        <ul className="flex flex-wrap gap-2 px-3 pb-2" aria-label="Comment attachments">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 rounded-lg border border-(--inbox-border) px-2.5 py-1.5"
            >
              <span className="flex size-7 items-center justify-center rounded-md bg-(--inbox-hover)">
                <FileText className="size-3.5 text-(--inbox-text-subtle)" aria-hidden />
              </span>
              <span className="flex flex-col">
                <span className="max-w-28 truncate text-xs font-medium tracking-[-0.1px] text-(--inbox-text)">
                  {file.name}
                </span>
                <span className="text-[11px] text-(--inbox-text-muted)">
                  {formatFileSize(file.size)}
                </span>
              </span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                className="ml-1 flex size-5 items-center justify-center rounded text-(--inbox-text-muted) outline-none hover:bg-(--inbox-hover) hover:text-(--inbox-text) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center justify-between gap-3 px-3 pb-2.5">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Attach files to this comment"
            disabled={files.length >= MAX_FILES}
            onClick={() => fileInputRef.current?.click()}
            className={ICON_BUTTON}
          >
            <Paperclip className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Mention a teammate"
            onClick={() => {
              const node = textareaRef.current;
              const start = node?.selectionStart ?? value.length;
              const needsSpace = start > 0 && !/\s/.test(value[start - 1] ?? " ");
              insertAtCaret(needsSpace ? " @" : "@");
              setMentionOpen(true);
              setActiveIndex(0);
            }}
            className={ICON_BUTTON}
          >
            <AtSign className="size-4" aria-hidden />
          </button>
          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger
              aria-label="Insert emoji"
              className={ICON_BUTTON}
            >
              <Smile className="size-4" aria-hidden />
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-64 rounded-lg border border-(--inbox-border) bg-(--inbox-surface-elevated) p-2 shadow-lg shadow-black/5"
            >
              <div role="group" aria-label="Emoji" className="grid grid-cols-8 gap-0.5">
                {EMOJI.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={`Insert ${emoji}`}
                    onClick={() => {
                      insertAtCaret(emoji);
                      setEmojiOpen(false);
                    }}
                    className="flex size-7 items-center justify-center rounded text-base outline-none hover:bg-(--inbox-hover) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onExpand}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-(--inbox-border) px-3 text-sm font-medium tracking-[-0.1px] text-(--inbox-text) outline-none transition-colors hover:bg-(--inbox-hover) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
          >
            <Reply className="size-4 text-(--inbox-text-subtle)" aria-hidden />
            Reply
          </button>
          <button
            type="button"
            disabled={(!value.trim() && files.length === 0) || posting}
            onClick={() => void submit()}
            className={SUBMIT_BUTTON}
          >
            {posting ? <Spinner className="size-3.5" /> : null}
            Comment
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}

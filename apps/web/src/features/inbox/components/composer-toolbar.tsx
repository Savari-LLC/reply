import type { EmailEditorRef } from "@react-email/editor";
import {
  Bold,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  RemoveFormatting,
  Strikethrough,
  TextQuote,
  Underline,
} from "lucide-react";
import { useEffect, useReducer } from "react";

type Editor = NonNullable<EmailEditorRef["editor"]>;

type ComposerToolbarProps = {
  editor: Editor | null;
  onInsertImage: () => void;
};

const TOOL =
  "flex size-7 shrink-0 items-center justify-center rounded-md text-(--inbox-text-subtle) outline-none transition-colors hover:bg-(--inbox-hover) hover:text-(--inbox-text) focus-visible:ring-2 focus-visible:ring-(--inbox-primary) disabled:pointer-events-none disabled:opacity-40";
const TOOL_ACTIVE = "bg-(--inbox-active) text-(--inbox-text-strong)";

/** Persistent formatting toolbar for the expanded composer (Figma composer frame). */
export function ComposerToolbar({ editor, onInsertImage }: ComposerToolbarProps) {
  const [, rerender] = useReducer((tick: number) => tick + 1, 0);

  // Re-render on selection/content changes so active states stay accurate.
  useEffect(() => {
    if (!editor) return;
    editor.on("transaction", rerender);
    return () => {
      editor.off("transaction", rerender);
    };
  }, [editor]);

  const toggleLink = () => {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().unsetMark("link").run();
      return;
    }
    const url = window.prompt("Link URL");
    if (url) editor.chain().focus().setMark("link", { href: url }).run();
  };

  const tools: Array<{
    label: string;
    icon: typeof Bold;
    active?: boolean;
    run: () => void;
  } | null> = [
    { label: "Bold", icon: Bold, active: editor?.isActive("bold"), run: () => editor?.chain().focus().toggleMark("bold").run() },
    { label: "Italic", icon: Italic, active: editor?.isActive("italic"), run: () => editor?.chain().focus().toggleMark("italic").run() },
    { label: "Underline", icon: Underline, active: editor?.isActive("underline"), run: () => editor?.chain().focus().toggleMark("underline").run() },
    { label: "Strikethrough", icon: Strikethrough, active: editor?.isActive("strike"), run: () => editor?.chain().focus().toggleMark("strike").run() },
    null,
    { label: "Bullet list", icon: List, active: editor?.isActive("bulletList"), run: () => editor?.chain().focus().toggleList("bulletList", "listItem").run() },
    { label: "Numbered list", icon: ListOrdered, active: editor?.isActive("orderedList"), run: () => editor?.chain().focus().toggleList("orderedList", "listItem").run() },
    { label: "Quote", icon: TextQuote, active: editor?.isActive("blockquote"), run: () => editor?.chain().focus().toggleWrap("blockquote").run() },
    null,
    { label: "Link", icon: LinkIcon, active: editor?.isActive("link"), run: toggleLink },
    { label: "Clear formatting", icon: RemoveFormatting, run: () => editor?.chain().focus().unsetAllMarks().clearNodes().run() },
  ];

  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className="flex items-center gap-0.5 border-b border-(--inbox-border-subtle) bg-(--inbox-surface) px-3 py-1.5"
    >
      {tools.map((tool, index) =>
        tool ? (
          <button
            key={tool.label}
            type="button"
            aria-label={tool.label}
            aria-pressed={tool.active ?? false}
            disabled={!editor}
            onClick={tool.run}
            className={`${TOOL} ${tool.active ? TOOL_ACTIVE : ""}`}
          >
            <tool.icon className="size-4" aria-hidden />
          </button>
        ) : (
          <span key={`divider-${index}`} className="mx-1 h-4 w-px bg-(--inbox-border)" aria-hidden />
        ),
      )}
      <button
        type="button"
        aria-label="Insert image"
        disabled={!editor}
        onClick={onInsertImage}
        className={TOOL}
      >
        <ImageIcon className="size-4" aria-hidden />
      </button>
    </div>
  );
}

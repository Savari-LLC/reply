import { getAvatarTint, getInitials } from "../utils";

type ConversationAvatarProps = {
  name: string;
  /** Diameter in pixels (Figma uses 20/24/32). */
  size?: number;
  /** Shows the green presence dot from the reference frames. */
  online?: boolean;
  className?: string;
};

/** Deterministic initials avatar with the Figma tint palette. Decorative only. */
export function ConversationAvatar({
  name,
  size = 32,
  online = false,
  className = "",
}: ConversationAvatarProps) {
  return (
    <span
      className={`relative inline-flex shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span
        className="flex size-full items-center justify-center rounded-full font-medium text-(--inbox-text)"
        style={{ backgroundColor: getAvatarTint(name), fontSize: size >= 28 ? 12 : 10 }}
      >
        {getInitials(name)}
      </span>
      {online ? (
        <span className="absolute right-0 bottom-0 size-2 rounded-full border border-(--inbox-surface-elevated) bg-(--inbox-success)" />
      ) : null}
    </span>
  );
}

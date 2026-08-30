import type { ThreadViewer } from "../types";
import { getAvatarTint } from "../utils";

const MAX_AVATARS = 3;

/**
 * Live "Viewing" pill from the Figma header: green dot, label, and an
 * overlapping 24px avatar group of everyone watching this thread right now.
 */
export function ConversationViewers({ viewers }: { viewers: ThreadViewer[] }) {
  if (viewers.length === 0) return null;

  const shown = viewers.slice(0, MAX_AVATARS);
  const overflow = viewers.length - shown.length;
  const names = viewers.map((viewer) => (viewer.isSelf ? "you" : viewer.name)).join(", ");

  return (
    <div
      className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-(--inbox-border) bg-(--inbox-surface) px-2"
      role="status"
      aria-label={`Currently viewing: ${names}`}
      title={`Viewing: ${names}`}
    >
      <span className="relative flex size-1.5" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-(--inbox-success) opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex size-1.5 rounded-full bg-(--inbox-success)" />
      </span>
      <span className="text-xs font-medium tracking-[-0.1px] text-(--inbox-text-muted)">
        Viewing
      </span>
      <span className="flex items-center" aria-hidden>
        {shown.map((viewer, index) => (
          <span
            key={viewer.id}
            className={`flex size-6 items-center justify-center overflow-hidden rounded-full border-[1.5px] border-white text-[10px] font-medium text-(--inbox-text) ${
              index < shown.length - 1 || overflow > 0 ? "-mr-2" : ""
            }`}
            style={{ backgroundColor: getAvatarTint(viewer.name) }}
          >
            {viewer.imageUrl ? (
              <img src={viewer.imageUrl} alt="" className="size-full object-cover" />
            ) : (
              viewer.initials
            )}
          </span>
        ))}
        {overflow > 0 ? (
          <span className="flex size-6 items-center justify-center rounded-full border-[1.5px] border-white bg-(--inbox-active) text-[10px] font-medium text-(--inbox-text-subtle)">
            +{overflow}
          </span>
        ) : null}
      </span>
    </div>
  );
}

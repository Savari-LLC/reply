import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@reply/ui/components/dropdown-menu";
import { Calendar, Inbox as InboxIcon, LogOut, PanelLeft, Settings } from "lucide-react";

import { getAvatarTint, getInitials } from "../utils";

const RAIL_ICONS = [
  { label: "Inbox", Icon: InboxIcon, active: true },
  { label: "Calendar", Icon: Calendar, active: false },
  { label: "Settings", Icon: Settings, active: false },
];

export type RailUser = {
  name: string;
  imageUrl?: string;
};

type SidebarRailProps = {
  /** Signed-in user; falls back to a static placeholder in fixture mode. */
  user?: RailUser;
  onSignOut?: () => void;
};

function RailAvatar({ user }: { user?: RailUser }) {
  if (user?.imageUrl) {
    return <img src={user.imageUrl} alt="" className="size-8 rounded-full object-cover" />;
  }
  if (user) {
    return (
      <span
        className="flex size-8 items-center justify-center rounded-full text-xs font-medium text-(--inbox-text)"
        style={{ backgroundColor: getAvatarTint(user.name) }}
        aria-hidden
      >
        {getInitials(user.name)}
      </span>
    );
  }
  return (
    <span
      className="flex size-8 items-center justify-center rounded-full bg-[#0185ff] text-lg font-medium text-white"
      aria-hidden
    >
      C
    </span>
  );
}

/** 48px utility rail: logo slot, icon group, spacer, and the current-user avatar. */
export function SidebarRail({ user, onSignOut }: SidebarRailProps) {
  const accountLabel = user ? `Signed in as ${user.name}` : "Signed in";

  return (
    <div className="flex w-12 shrink-0 flex-col items-center border-r border-(--inbox-border-subtle) bg-(--inbox-nav)">
      <div className="flex items-center justify-center py-3">
        <span className="flex size-8 items-center justify-center rounded-lg text-(--inbox-text-subtle)">
          <PanelLeft className="size-4" aria-hidden />
        </span>
      </div>
      <div className="flex flex-col gap-1.5 p-2">
        {RAIL_ICONS.map(({ label, Icon, active }) => (
          <span
            key={label}
            title={label}
            className={`flex size-8 items-center justify-center rounded-lg ${
              active
                ? "bg-(--inbox-action-secondary-hover) text-(--inbox-text)"
                : "text-(--inbox-text-subtle)"
            }`}
          >
            <Icon className="size-4" aria-hidden />
            <span className="sr-only">{label}</span>
          </span>
        ))}
      </div>
      <div className="min-h-0 flex-1" />
      <div className="px-2 pb-3 pt-2">
        {onSignOut ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Account menu — ${accountLabel}`}
              className="relative block size-8 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
            >
              <RailAvatar user={user} />
              <span
                className="absolute right-0 bottom-0 size-2 rounded-full bg-(--inbox-success) ring-2 ring-white"
                aria-hidden
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="right"
              align="end"
              className="min-w-44 rounded-lg border border-(--inbox-border) bg-(--inbox-surface-elevated) p-1 shadow-(--inbox-shadow-sm)"
            >
              <DropdownMenuLabel className="truncate text-xs font-medium text-(--inbox-text-muted)">
                {accountLabel}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="rounded-md text-sm text-(--inbox-text)"
                onClick={onSignOut}
              >
                <LogOut className="size-4" aria-hidden />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="relative block size-8" aria-label={`${accountLabel}, online`}>
            <RailAvatar user={user} />
            <span
              className="absolute right-0 bottom-0 size-2 rounded-full bg-(--inbox-success) ring-2 ring-white"
              aria-hidden
            />
          </span>
        )}
      </div>
    </div>
  );
}

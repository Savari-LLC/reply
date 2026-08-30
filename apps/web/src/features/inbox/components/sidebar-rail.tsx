import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@reply/ui/components/dropdown-menu";
import { Link } from "@tanstack/react-router";
import {
  Calendar,
  Inbox as InboxIcon,
  LogOut,
  PanelLeft,
  Settings,
  UserPen,
} from "lucide-react";
import { useState } from "react";

import { ProfileDialog } from "@/features/profile/profile-dialog";

import { getAvatarTint, getInitials } from "../utils";

export type RailSection = "inbox" | "settings";

const RAIL_ICONS: Array<{
  label: string;
  Icon: typeof InboxIcon;
  section?: RailSection;
  to?: string;
}> = [
  { label: "Inbox", Icon: InboxIcon, section: "inbox", to: "/inbox" },
  { label: "Calendar", Icon: Calendar },
  { label: "Settings", Icon: Settings, section: "settings", to: "/settings" },
];

export type RailUser = {
  name: string;
  imageUrl?: string;
};

type SidebarRailProps = {
  /** Signed-in user; falls back to a static placeholder in fixture mode. */
  user?: RailUser;
  onSignOut?: () => void;
  /** Which rail destination is active; defaults to the inbox. */
  activeSection?: RailSection;
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
export function SidebarRail({ user, onSignOut, activeSection = "inbox" }: SidebarRailProps) {
  const accountLabel = user ? `Signed in as ${user.name}` : "Signed in";
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className="flex w-12 shrink-0 flex-col items-center border-r border-(--inbox-border-subtle) bg-(--inbox-nav)">
      <div className="flex items-center justify-center py-3">
        <span className="flex size-8 items-center justify-center rounded-lg text-(--inbox-text-subtle)">
          <PanelLeft className="size-4" aria-hidden />
        </span>
      </div>
      <div className="flex flex-col gap-1.5 p-2">
        {RAIL_ICONS.map(({ label, Icon, section, to }) => {
          const active = section !== undefined && section === activeSection;
          const className = `flex size-8 items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-(--inbox-primary) ${
            active
              ? "bg-(--inbox-action-secondary-hover) text-(--inbox-text)"
              : "text-(--inbox-text-subtle)"
          }`;
          if (to) {
            return (
              <Link
                key={label}
                to={to}
                title={label}
                aria-current={active ? "page" : undefined}
                className={`${className} hover:bg-(--inbox-hover) hover:text-(--inbox-text)`}
              >
                <Icon className="size-4" aria-hidden />
                <span className="sr-only">{label}</span>
              </Link>
            );
          }
          return (
            <span key={label} title={`${label} (coming soon)`} className={className}>
              <Icon className="size-4" aria-hidden />
              <span className="sr-only">{label} (coming soon)</span>
            </span>
          );
        })}
      </div>
      <div className="min-h-0 flex-1" />
      <div className="px-2 pb-3 pt-2">
        {onSignOut ? (
          <>
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
                className="min-w-48 rounded-lg border border-(--inbox-border) bg-(--inbox-surface-elevated) p-1 shadow-(--inbox-shadow-sm)"
              >
                {/* GroupLabel needs a Group ancestor; Base UI throws without one. */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="truncate text-xs font-medium text-(--inbox-text-muted)">
                    {accountLabel}
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="rounded-md text-sm text-(--inbox-text)"
                  onClick={() => setProfileOpen(true)}
                >
                  <UserPen className="size-4" aria-hidden />
                  Edit profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="rounded-md text-sm text-(--inbox-text)"
                  onClick={onSignOut}
                >
                  <LogOut className="size-4" aria-hidden />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
          </>
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

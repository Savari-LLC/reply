import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@reply/backend/convex/_generated/api";
import type { Doc } from "@reply/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { Inbox as InboxIcon, Users } from "lucide-react";

import { SidebarRail } from "@/features/inbox/components/sidebar-rail";

import { SECTION_DESCRIPTIONS, SECTION_LABELS, type SettingsSection } from "./constants";
import { InboxesSection } from "./inboxes-section";
import { MembersSection } from "./members-section";

import "@/features/inbox/inbox.css";

const SECTION_ICONS = { members: Users, inboxes: InboxIcon } as const;

type SettingsScreenProps = {
  section: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  workspace: Doc<"workspaces">;
  membership: Doc<"memberships">;
};

/**
 * Workspace settings: user management first, with inbox and channel
 * management alongside. Mirrors the inbox shell (rail + nav + content).
 */
export function SettingsScreen({
  section,
  onSectionChange,
  workspace,
  membership,
}: SettingsScreenProps) {
  const { signOut } = useAuthActions();
  const profile = useQuery(api.users.getProfile, {});
  const isAdmin = membership.role === "admin";
  const railUser = profile
    ? { name: profile.name, imageUrl: profile.imageUrl ?? undefined }
    : undefined;

  return (
    <main className="inbox-root flex h-svh w-full min-w-[1024px] overflow-hidden bg-(--inbox-canvas) font-sans text-sm antialiased">
      <div className="flex h-full shrink-0">
        <SidebarRail
          user={railUser}
          onSignOut={() => void signOut()}
          activeSection="settings"
        />
        <div className="flex w-[clamp(176px,13vw,200px)] flex-col overflow-y-auto bg-(--inbox-nav)">
          <div className="flex flex-col gap-3 p-3">
            <p className="truncate px-1 text-base font-semibold tracking-[-0.1px] text-(--inbox-text-strong)">
              Settings
            </p>
            <p className="truncate px-1 text-xs tracking-[-0.1px] text-(--inbox-text-muted)">
              {workspace.name}
            </p>
          </div>
          <div className="mx-3 h-px shrink-0 bg-(--inbox-border-subtle)" aria-hidden />
          <nav className="flex flex-col gap-1 px-3 py-2" aria-label="Settings sections">
            {(Object.keys(SECTION_LABELS) as SettingsSection[]).map((key) => {
              const Icon = SECTION_ICONS[key];
              const selected = key === section;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSectionChange(key)}
                  aria-current={selected ? "true" : undefined}
                  className={`flex h-8 w-full shrink-0 items-center gap-2 rounded-lg px-3 text-sm tracking-[-0.1px] outline-none focus-visible:ring-2 focus-visible:ring-(--inbox-primary) ${
                    selected
                      ? "bg-(--inbox-surface) text-(--inbox-text-strong) shadow-(--inbox-shadow-sm)"
                      : "text-(--inbox-text) hover:bg-(--inbox-hover)"
                  }`}
                >
                  <Icon className="size-4 shrink-0 text-(--inbox-text-subtle)" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-left">{SECTION_LABELS[key]}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 py-3 pr-3">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-(--inbox-surface)">
          <header className="shrink-0 border-b border-(--inbox-border-subtle) px-6 pt-5 pb-4">
            <h1 className="text-lg font-semibold tracking-[-0.2px] text-(--inbox-text-strong)">
              {SECTION_LABELS[section]}
            </h1>
            <p className="mt-1 text-sm tracking-[-0.1px] text-(--inbox-text-muted)">
              {SECTION_DESCRIPTIONS[section]}
            </p>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {section === "members" ? (
              <MembersSection isAdmin={isAdmin} />
            ) : (
              <InboxesSection isAdmin={isAdmin} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

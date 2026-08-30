import { Calendar, Inbox as InboxIcon, PanelLeft, Settings } from "lucide-react";

const RAIL_ICONS = [
  { label: "Inbox", Icon: InboxIcon, active: true },
  { label: "Calendar", Icon: Calendar, active: false },
  { label: "Settings", Icon: Settings, active: false },
];

/** 48px utility rail: logo slot, icon group, spacer, and the current-user avatar. */
export function SidebarRail() {
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
        <span className="relative block size-8" aria-label="Signed in as Connor, online">
          <span className="flex size-8 items-center justify-center rounded-full bg-[#0185ff] text-lg font-medium text-white">
            C
          </span>
          <span
            className="absolute right-0 bottom-0 size-2 rounded-full bg-(--inbox-success) ring-2 ring-white"
            aria-hidden
          />
        </span>
      </div>
    </div>
  );
}

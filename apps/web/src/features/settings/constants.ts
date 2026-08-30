export const SETTINGS_SECTIONS = ["members", "inboxes"] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const SECTION_LABELS: Record<SettingsSection, string> = {
  members: "Members",
  inboxes: "Inboxes & channels",
};

export const SECTION_DESCRIPTIONS: Record<SettingsSection, string> = {
  members: "Invite teammates, manage roles, and control who is in this workspace.",
  inboxes: "Create inboxes, link channels, and choose who can work in each one.",
};

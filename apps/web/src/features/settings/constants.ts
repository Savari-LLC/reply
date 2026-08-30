export const SETTINGS_SECTIONS = ["members", "inboxes"] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const SECTION_LABELS: Record<SettingsSection, string> = {
  members: "Members",
  inboxes: "Inboxes",
};

export const SECTION_DESCRIPTIONS: Record<SettingsSection, string> = {
  members: "Invite teammates, manage roles, and control who is in this workspace.",
  inboxes:
    "Create inboxes, connect the channels that feed them, and choose who can work in each one.",
};

export type SampleDataset = "sales" | "accounts" | "support";

export const DATASET_OPTIONS: Array<{ value: SampleDataset; label: string }> = [
  { value: "sales", label: "Sales conversations" },
  { value: "accounts", label: "Accounts conversations" },
  { value: "support", label: "Support conversations" },
];

/** Convex throws plain errors; strip the wrapper so toasts read like copy. */
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message.replace(/^Uncaught (Error: )?/, "").replace(/ at .*$/s, "")
    : "Something went wrong. Please try again.";
}

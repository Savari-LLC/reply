/**
 * Reply brand tokens, ported from `apps/web/src/features/inbox/inbox.css`
 * and `apps/web/src/components/auth-panel.tsx`, adapted to iOS conventions
 * (SF system font, native grouped surfaces).
 */
export const colors = {
  // Inbox surfaces
  canvas: "#f0f0f2",
  surface: "#fafafa",
  surfaceElevated: "#ffffff",
  hover: "#f0f0f0",
  active: "#ebebeb",
  border: "#e6e6e6",
  borderSubtle: "#ebebeb",

  // Text
  textStrong: "#000000",
  text: "#262626",
  textSubtle: "#525252",
  textMuted: "#737373",
  textInverse: "#fafafa",

  // Actions
  primary: "#0d9488",
  primaryText: "#0f766e",
  success: "#22c55e",
  destructive: "#dc2626",
  destructiveBg: "#fbe9e9",

  // Auth / marketing palette
  authCanvas: "#eef0ec",
  brandDark: "#202d2a",
  brandDarkPressed: "#30423e",
  brandCoral: "#ff7a66",
  brandYellow: "#f7c95c",
  brandRust: "#bc5644",
  authCard: "#fbfbf8",
  authField: "#ffffff",
} as const;

export type LabelAccent = "magenta" | "purple" | "amber" | "yellow" | "blue";

export const LABEL_ACCENTS: Record<
  LabelAccent,
  { dot: string; bg: string; text: string }
> = {
  magenta: { dot: "#ff34a7", bg: "#ffd6e9", text: "#960d68" },
  purple: { dot: "#822dd2", bg: "#f0d6ff", text: "#5b1e94" },
  amber: { dot: "#f75d0a", bg: "#ffe3d1", text: "#9a3a06" },
  yellow: { dot: "#fad805", bg: "#fdf3bc", text: "#6e5f02" },
  blue: { dot: "#0185ff", bg: "#d6ecff", text: "#0e43a0" },
};

/** Seeded label colors mapped onto the frozen accent palette (matches web). */
export const LABEL_COLOR_ACCENTS: Record<string, LabelAccent> = {
  "#2563eb": "blue", // New lead
  "#9333ea": "purple", // VIP
  "#d97706": "amber", // Billing
  "#dc2626": "magenta", // Bug
  "#059669": "yellow", // Renewal
  "#0891b2": "blue", // Feature request
};

/** Known shared-inbox accents; unknown inboxes rotate through the fallback list. */
export const INBOX_ACCENTS: Record<string, LabelAccent> = {
  sales: "purple",
  accounts: "blue",
  support: "magenta",
};

export const FALLBACK_ACCENTS: LabelAccent[] = [
  "purple",
  "blue",
  "magenta",
  "amber",
  "yellow",
];

export const STATUS_LABELS = {
  open: "Open",
  waiting: "Waiting",
  closed: "Done",
} as const;

export type ThreadStatus = keyof typeof STATUS_LABELS;

import { CATEGORY_META, LABEL_ACCENT_STYLES, TECHNICAL_REVIEW_THRESHOLD } from "../constants";
import type { Classification } from "../types";

type ClassificationBadgeProps = {
  classification: Classification;
  /** Compact rendering for thread-list rows. */
  size?: "sm" | "md";
};

/**
 * Auto-triage category pill. Technical emails below the auto-investigation
 * threshold render as "Possible Technical Issue · Needs Review" so nobody
 * mistakes them for confirmed incidents.
 */
export function ClassificationBadge({ classification, size = "md" }: ClassificationBadgeProps) {
  const meta = CATEGORY_META[classification.category];
  const needsReview =
    classification.category === "technical" &&
    classification.confidence < TECHNICAL_REVIEW_THRESHOLD;
  const accent = LABEL_ACCENT_STYLES[needsReview ? "amber" : meta.accent];
  const label = needsReview ? "Possible Technical Issue · Needs Review" : meta.label;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full font-medium tracking-[-0.1px] ${
        size === "sm" ? "px-1.5 text-xs" : "px-2 py-0.5 text-xs"
      }`}
      style={{ backgroundColor: accent.bg, color: accent.text }}
      title={classification.shortSummary}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: accent.dot }}
        aria-hidden
      />
      {label}
    </span>
  );
}

import type { ThreadFilter } from "./constants";
import type { ThreadSummary } from "./types";

/** "Nikolas Gibbons" -> "NG"; single words fall back to the first two letters. */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/** Compact relative timestamps matching the Figma reference ("15m ago", "3h ago"). */
export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Date-separator label used between message groups ("July 14, 2026"). */
export function formatDateSeparator(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function filterThreads(threads: ThreadSummary[], filter: ThreadFilter): ThreadSummary[] {
  if (filter === "all") return threads;
  return threads.filter((thread) => thread.status === filter);
}

/** Deterministic avatar tints from the Figma avatar palette. */
const AVATAR_TINTS = ["#c0c0c0", "#cbcbcb", "#cfd4c6", "#dbcabd", "#f0d6ff", "#ffd6e9"] as const;

export function getAvatarTint(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length]!;
}

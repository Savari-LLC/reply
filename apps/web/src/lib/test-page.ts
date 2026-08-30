export function timeAgo(timestamp: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export const statusStyles: Record<string, string> = {
  open: "border-emerald-200 bg-emerald-50 text-emerald-700",
  waiting: "border-amber-200 bg-amber-50 text-amber-700",
  closed: "border-zinc-200 bg-zinc-100 text-zinc-500",
};

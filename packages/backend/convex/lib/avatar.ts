import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type StorageCtx = Pick<MutationCtx | QueryCtx, "storage">;

/** Display name for a person, falling back through the fields we may have. */
export function displayName(user: Doc<"users">) {
  return user.name ?? user.username ?? "Teammate";
}

/**
 * Resolves the avatar to show for a user: an uploaded file wins over the
 * image the auth provider gave us. Returns null when there is nothing to show
 * so the UI can fall back to initials.
 */
export async function avatarUrl(ctx: StorageCtx, user: Doc<"users">): Promise<string | null> {
  if (user.imageStorageId) {
    const url = await ctx.storage.getUrl(user.imageStorageId);
    if (url !== null) return url;
  }
  return user.authProvider === "google" ? (user.image ?? null) : null;
}

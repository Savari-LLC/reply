import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/** Rows predating the `kind` field are shared inboxes. */
export function inboxKind(inbox: Doc<"inboxes">): "shared" | "personal" {
  return inbox.kind ?? "shared";
}

/**
 * Personal inboxes are visible only to their owner. Shared inboxes are visible
 * to workspace admins and to members with an `inboxAccess` grant.
 */
export async function canAccessInbox(
  ctx: QueryCtx,
  membership: Doc<"memberships">,
  inbox: Doc<"inboxes">,
): Promise<boolean> {
  if (inbox.workspaceId !== membership.workspaceId) return false;
  if (inboxKind(inbox) === "personal") return inbox.ownerId === membership.userId;
  if (membership.role === "admin") return true;
  const grant = await ctx.db
    .query("inboxAccess")
    .withIndex("by_inboxId_and_userId", (q) =>
      q.eq("inboxId", inbox._id).eq("userId", membership.userId),
    )
    .unique();
  return grant !== null;
}

export async function requireInboxAccess(
  ctx: QueryCtx,
  membership: Doc<"memberships">,
  inboxId: Id<"inboxes">,
): Promise<Doc<"inboxes">> {
  const inbox = await ctx.db.get(inboxId);
  if (!inbox || !(await canAccessInbox(ctx, membership, inbox))) {
    throw new Error("Inbox not found");
  }
  return inbox;
}

/** Every member owns exactly one personal inbox per workspace. */
export async function ensurePersonalInbox(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">,
): Promise<Id<"inboxes">> {
  const existing = await ctx.db
    .query("inboxes")
    .withIndex("by_workspaceId_and_ownerId", (q) =>
      q.eq("workspaceId", workspaceId).eq("ownerId", userId),
    )
    .first();
  if (existing) return existing._id;
  return await ctx.db.insert("inboxes", {
    workspaceId,
    name: "Your inbox",
    kind: "personal",
    ownerId: userId,
  });
}

/**
 * New members start with access to every existing shared inbox; admins can
 * revoke per inbox from Settings.
 */
export async function grantAllSharedInboxes(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">,
) {
  const inboxes = await ctx.db
    .query("inboxes")
    .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  for (const inbox of inboxes) {
    if (inboxKind(inbox) !== "shared") continue;
    const grant = await ctx.db
      .query("inboxAccess")
      .withIndex("by_inboxId_and_userId", (q) =>
        q.eq("inboxId", inbox._id).eq("userId", userId),
      )
      .unique();
    if (!grant) {
      await ctx.db.insert("inboxAccess", { workspaceId, inboxId: inbox._id, userId });
    }
  }
}

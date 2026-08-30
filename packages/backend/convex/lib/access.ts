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

/** Rows predating the `kind` field are shared channels. */
export function channelKind(channel: Doc<"channels">): "shared" | "personal" {
  return channel.kind ?? "shared";
}

/**
 * Whether a member may see and link a channel: owners for personal channels;
 * admins or members holding a `channelAccess` grant for shared channels.
 */
export async function canUseChannel(
  ctx: QueryCtx,
  membership: Doc<"memberships">,
  channel: Doc<"channels">,
): Promise<boolean> {
  if (channel.workspaceId !== membership.workspaceId) return false;
  if (channelKind(channel) === "personal") return channel.ownerId === membership.userId;
  if (membership.role === "admin") return true;
  const grant = await ctx.db
    .query("channelAccess")
    .withIndex("by_channelId_and_userId", (q) =>
      q.eq("channelId", channel._id).eq("userId", membership.userId),
    )
    .unique();
  return grant !== null;
}

/** Managing (renaming, deleting, permissions) is owner/admin territory. */
export function canManageChannel(
  membership: Doc<"memberships">,
  channel: Doc<"channels">,
): boolean {
  if (channel.workspaceId !== membership.workspaceId) return false;
  if (channelKind(channel) === "personal") return channel.ownerId === membership.userId;
  return membership.role === "admin";
}

/** Owners manage their personal inbox; admins manage shared inboxes. */
export function canManageInbox(
  membership: Doc<"memberships">,
  inbox: Doc<"inboxes">,
): boolean {
  if (inbox.workspaceId !== membership.workspaceId) return false;
  if (inboxKind(inbox) === "personal") return inbox.ownerId === membership.userId;
  return membership.role === "admin";
}

/** Channels linked into an inbox, in link order. */
export async function getLinkedChannels(
  ctx: QueryCtx,
  inboxId: Id<"inboxes">,
): Promise<Doc<"channels">[]> {
  const links = await ctx.db
    .query("inboxChannels")
    .withIndex("by_inboxId_and_channelId", (q) => q.eq("inboxId", inboxId))
    .collect();
  const channels = await Promise.all(links.map((link) => ctx.db.get(link.channelId)));
  return channels.flatMap((channel) => (channel ? [channel] : []));
}

/** Inboxes a channel surfaces in. */
export async function getLinkedInboxes(
  ctx: QueryCtx,
  channelId: Id<"channels">,
): Promise<Doc<"inboxes">[]> {
  const links = await ctx.db
    .query("inboxChannels")
    .withIndex("by_channelId", (q) => q.eq("channelId", channelId))
    .collect();
  const inboxes = await Promise.all(links.map((link) => ctx.db.get(link.inboxId)));
  return inboxes.flatMap((inbox) => (inbox ? [inbox] : []));
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

import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireWorkspaceAdmin, requireWorkspaceContext } from "./authHelpers";
import { canAccessInbox, getLinkedChannels, inboxKind } from "./lib/access";
import { deleteInboxCascade } from "./lib/cascade";

const channelValidator = v.object({
  _id: v.id("channels"),
  provider: v.union(v.literal("gmail"), v.literal("outlook"), v.literal("demo")),
  emailAddress: v.string(),
  displayName: v.string(),
  status: v.union(v.literal("connected"), v.literal("disconnected")),
  kind: v.union(v.literal("shared"), v.literal("personal")),
});

const settingsInboxValidator = v.object({
  _id: v.id("inboxes"),
  name: v.string(),
  kind: v.union(v.literal("shared"), v.literal("personal")),
  isOwn: v.boolean(),
  threadCount: v.number(),
  channels: v.array(channelValidator),
  /** Members holding an access grant; only meaningful on shared inboxes. */
  accessUserIds: v.array(v.id("users")),
});

function normalizeInboxName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2) throw new Error("Inbox name must be at least 2 characters");
  if (name.length > 60) throw new Error("Inbox name must be at most 60 characters");
  return name;
}

/**
 * Settings view of every inbox the caller may manage or read: admins see all
 * shared inboxes plus their own personal inbox; members see their granted
 * shared inboxes plus their own personal inbox.
 */
export const listSettings = query({
  args: {},
  returns: v.array(settingsInboxValidator),
  handler: async (ctx) => {
    const context = await requireWorkspaceContext(ctx);
    const inboxes = await ctx.db
      .query("inboxes")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", context.workspace._id))
      .collect();
    const isAdmin = context.membership.role === "admin";
    const result = [];
    for (const inbox of inboxes) {
      if (!(await canAccessInbox(ctx, context.membership, inbox))) continue;
      const channels = await getLinkedChannels(ctx, inbox._id);
      let threadCount = 0;
      for (const channel of channels) {
        const channelThreads = await ctx.db
          .query("threads")
          .withIndex("by_channelId_and_lastMessageAt", (q) =>
            q.eq("channelId", channel._id),
          )
          .collect();
        threadCount += channelThreads.length;
      }
      const grants =
        isAdmin && inboxKind(inbox) === "shared"
          ? await ctx.db
              .query("inboxAccess")
              .withIndex("by_workspaceId_and_inboxId", (q) =>
                q.eq("workspaceId", context.workspace._id).eq("inboxId", inbox._id),
              )
              .collect()
          : [];
      result.push({
        _id: inbox._id,
        name: inbox.name,
        kind: inboxKind(inbox),
        isOwn: inbox.ownerId === context.user._id,
        threadCount,
        channels: channels.map((channel) => ({
          _id: channel._id,
          provider: channel.provider,
          emailAddress: channel.emailAddress,
          displayName: channel.displayName,
          status: channel.status,
          kind: channel.kind ?? "shared",
        })),
        accessUserIds: grants.map((grant) => grant.userId),
      });
    }
    // Personal inbox first, then shared in creation order (mirrors the app rail).
    result.sort((a, b) => {
      const aPersonal = a.kind === "personal" ? 0 : 1;
      const bPersonal = b.kind === "personal" ? 0 : 1;
      return aPersonal - bPersonal;
    });
    return result;
  },
});

export const create = mutation({
  args: { name: v.string() },
  returns: v.id("inboxes"),
  handler: async (ctx, args) => {
    const context = await requireWorkspaceAdmin(ctx);
    const name = normalizeInboxName(args.name);
    const existing = await ctx.db
      .query("inboxes")
      .withIndex("by_workspaceId_and_name", (q) =>
        q.eq("workspaceId", context.workspace._id).eq("name", name),
      )
      .first();
    if (existing) throw new Error(`An inbox named “${name}” already exists`);
    return await ctx.db.insert("inboxes", {
      workspaceId: context.workspace._id,
      name,
      kind: "shared",
    });
  },
});

export const rename = mutation({
  args: { inboxId: v.id("inboxes"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await requireWorkspaceContext(ctx);
    const inbox = await ctx.db.get(args.inboxId);
    if (!inbox || inbox.workspaceId !== context.workspace._id) {
      throw new Error("Inbox not found");
    }
    const canManage =
      inboxKind(inbox) === "personal"
        ? inbox.ownerId === context.user._id
        : context.membership.role === "admin";
    if (!canManage) throw new Error("Only a workspace admin can rename this inbox");
    await ctx.db.patch(inbox._id, { name: normalizeInboxName(args.name) });
    return null;
  },
});

export const remove = mutation({
  args: { inboxId: v.id("inboxes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await requireWorkspaceAdmin(ctx);
    const inbox = await ctx.db.get(args.inboxId);
    if (!inbox || inbox.workspaceId !== context.workspace._id) {
      throw new Error("Inbox not found");
    }
    if (inboxKind(inbox) === "personal") {
      throw new Error("Personal inboxes cannot be deleted");
    }
    await deleteInboxCascade(ctx, inbox);
    return null;
  },
});

export const setAccess = mutation({
  args: {
    inboxId: v.id("inboxes"),
    userId: v.id("users"),
    allowed: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await requireWorkspaceAdmin(ctx);
    const inbox = await ctx.db.get(args.inboxId);
    if (!inbox || inbox.workspaceId !== context.workspace._id) {
      throw new Error("Inbox not found");
    }
    if (inboxKind(inbox) === "personal") {
      throw new Error("Personal inboxes are private to their owner");
    }
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_workspaceId_and_userId", (q) =>
        q.eq("workspaceId", context.workspace._id).eq("userId", args.userId),
      )
      .unique();
    if (!membership) throw new Error("This person is not in your workspace");
    const grant = await ctx.db
      .query("inboxAccess")
      .withIndex("by_inboxId_and_userId", (q) =>
        q.eq("inboxId", inbox._id).eq("userId", args.userId),
      )
      .unique();
    if (args.allowed && !grant) {
      await ctx.db.insert("inboxAccess", {
        workspaceId: context.workspace._id,
        inboxId: inbox._id,
        userId: args.userId,
      });
    } else if (!args.allowed && grant) {
      await ctx.db.delete(grant._id);
    }
    return null;
  },
});

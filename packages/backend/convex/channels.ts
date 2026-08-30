import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireWorkspaceAdmin, requireWorkspaceContext } from "./authHelpers";
import {
  canManageChannel,
  canManageInbox,
  canUseChannel,
  channelKind,
  getLinkedInboxes,
} from "./lib/access";
import { deleteChannelCascade } from "./lib/cascade";
import { createSampleChannel, sampleDatasetValidator } from "./seed";

const settingsChannelValidator = v.object({
  _id: v.id("channels"),
  provider: v.union(v.literal("gmail"), v.literal("outlook"), v.literal("demo")),
  emailAddress: v.string(),
  displayName: v.string(),
  status: v.union(v.literal("connected"), v.literal("disconnected")),
  kind: v.union(v.literal("shared"), v.literal("personal")),
  isOwn: v.boolean(),
  canManage: v.boolean(),
  threadCount: v.number(),
  linkedInboxes: v.array(v.object({ _id: v.id("inboxes"), name: v.string() })),
  /** Members granted use of a shared channel; only populated for managers. */
  accessUserIds: v.array(v.id("users")),
});

function normalizeChannelName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2) throw new Error("Channel name must be at least 2 characters");
  if (name.length > 60) throw new Error("Channel name must be at most 60 characters");
  return name;
}

function sampleEmailAddress(name: string) {
  const slug =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "sample";
  return `${slug}@sample.reply.test`;
}

/**
 * Every channel the caller may see: their personal channels plus shared
 * channels they can use (admins see all shared channels).
 */
export const listSettings = query({
  args: {},
  returns: v.array(settingsChannelValidator),
  handler: async (ctx) => {
    const context = await requireWorkspaceContext(ctx);
    const channels = await ctx.db
      .query("channels")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", context.workspace._id))
      .collect();
    const result = [];
    for (const channel of channels) {
      if (!(await canUseChannel(ctx, context.membership, channel))) continue;
      const manage = canManageChannel(context.membership, channel);
      const linkedInboxes = await getLinkedInboxes(ctx, channel._id);
      const channelThreads = await ctx.db
        .query("threads")
        .withIndex("by_channelId_and_lastMessageAt", (q) => q.eq("channelId", channel._id))
        .collect();
      const grants =
        manage && channelKind(channel) === "shared"
          ? await ctx.db
              .query("channelAccess")
              .withIndex("by_workspaceId_and_channelId", (q) =>
                q.eq("workspaceId", context.workspace._id).eq("channelId", channel._id),
              )
              .collect()
          : [];
      result.push({
        _id: channel._id,
        provider: channel.provider,
        emailAddress: channel.emailAddress,
        displayName: channel.displayName,
        status: channel.status,
        kind: channelKind(channel),
        isOwn: channel.ownerId === context.user._id,
        canManage: manage,
        threadCount: channelThreads.length,
        linkedInboxes: linkedInboxes.map((inbox) => ({ _id: inbox._id, name: inbox.name })),
        accessUserIds: grants.map((grant) => grant.userId),
      });
    }
    // Personal channels first, mirroring the inbox grouping.
    result.sort((a, b) => {
      const aPersonal = a.kind === "personal" ? 0 : 1;
      const bPersonal = b.kind === "personal" ? 0 : 1;
      return aPersonal - bPersonal;
    });
    return result;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    provider: v.union(v.literal("gmail"), v.literal("outlook"), v.literal("demo")),
    dataset: v.optional(sampleDatasetValidator),
    kind: v.union(v.literal("shared"), v.literal("personal")),
  },
  returns: v.id("channels"),
  handler: async (ctx, args) => {
    const context = await requireWorkspaceContext(ctx);
    if (args.kind === "shared" && context.membership.role !== "admin") {
      throw new Error("Only a workspace admin can create shared channels");
    }
    if (args.provider === "gmail") {
      throw new Error("Gmail connections are coming soon");
    }
    if (args.provider === "outlook") {
      throw new Error("Outlook connections are coming soon");
    }
    const name = normalizeChannelName(args.name);
    const result = await createSampleChannel(ctx, {
      workspaceId: context.workspace._id,
      actorId: context.user._id,
      dataset: args.dataset ?? "sales",
      displayName: name,
      emailAddress: sampleEmailAddress(name),
      kind: args.kind,
    });
    return result.channelId;
  },
});

/** Links a channel into an inbox the caller manages. Idempotent. */
export const link = mutation({
  args: { inboxId: v.id("inboxes"), channelId: v.id("channels") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await requireWorkspaceContext(ctx);
    const inbox = await ctx.db.get(args.inboxId);
    if (!inbox || !canManageInbox(context.membership, inbox)) {
      throw new Error("Inbox not found");
    }
    const channel = await ctx.db.get(args.channelId);
    if (!channel || !(await canUseChannel(ctx, context.membership, channel))) {
      throw new Error("Channel not found");
    }
    const existing = await ctx.db
      .query("inboxChannels")
      .withIndex("by_inboxId_and_channelId", (q) =>
        q.eq("inboxId", inbox._id).eq("channelId", channel._id),
      )
      .unique();
    if (!existing) {
      await ctx.db.insert("inboxChannels", {
        workspaceId: context.workspace._id,
        inboxId: inbox._id,
        channelId: channel._id,
      });
    }
    return null;
  },
});

export const unlink = mutation({
  args: { inboxId: v.id("inboxes"), channelId: v.id("channels") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await requireWorkspaceContext(ctx);
    const inbox = await ctx.db.get(args.inboxId);
    if (!inbox || !canManageInbox(context.membership, inbox)) {
      throw new Error("Inbox not found");
    }
    const existing = await ctx.db
      .query("inboxChannels")
      .withIndex("by_inboxId_and_channelId", (q) =>
        q.eq("inboxId", inbox._id).eq("channelId", args.channelId),
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});

/** Grants or revokes a member's right to use a shared channel. */
export const setAccess = mutation({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
    allowed: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await requireWorkspaceAdmin(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel || channel.workspaceId !== context.workspace._id) {
      throw new Error("Channel not found");
    }
    if (channelKind(channel) === "personal") {
      throw new Error("Personal channels are private to their owner");
    }
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_workspaceId_and_userId", (q) =>
        q.eq("workspaceId", context.workspace._id).eq("userId", args.userId),
      )
      .unique();
    if (!membership) throw new Error("This person is not in your workspace");
    const grant = await ctx.db
      .query("channelAccess")
      .withIndex("by_channelId_and_userId", (q) =>
        q.eq("channelId", channel._id).eq("userId", args.userId),
      )
      .unique();
    if (args.allowed && !grant) {
      await ctx.db.insert("channelAccess", {
        workspaceId: context.workspace._id,
        channelId: channel._id,
        userId: args.userId,
      });
    } else if (!args.allowed && grant) {
      await ctx.db.delete(grant._id);
    }
    return null;
  },
});

export const remove = mutation({
  args: { channelId: v.id("channels") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await requireWorkspaceContext(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel || !canManageChannel(context.membership, channel)) {
      throw new Error("Channel not found");
    }
    await deleteChannelCascade(ctx, channel);
    return null;
  },
});

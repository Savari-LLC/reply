import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireWorkspaceAdmin, requireWorkspaceContext } from "./authHelpers";
import {
  canAccessInbox,
  canManageInbox,
  getInboxChannels,
  inboxKind,
} from "./lib/access";
import { deleteInboxCascade } from "./lib/cascade";
import { channelProviderValidator } from "./lib/providers";

const channelValidator = v.object({
  _id: v.id("channels"),
  provider: channelProviderValidator,
  address: v.string(),
  status: v.union(v.literal("connected"), v.literal("disconnected")),
  threadCount: v.number(),
  mailConnection: v.union(
    v.object({
      syncStatus: v.union(v.literal("idle"), v.literal("syncing"), v.literal("error")),
      lastSyncedAt: v.union(v.number(), v.null()),
      lastSyncError: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
});

const settingsInboxValidator = v.object({
  _id: v.id("inboxes"),
  name: v.string(),
  kind: v.union(v.literal("shared"), v.literal("personal")),
  isOwn: v.boolean(),
  canManage: v.boolean(),
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
 * Shared inbox names are unique across the workspace; personal inbox names are
 * unique per owner, so two members can both keep a "Newsletters" inbox.
 */
async function requireNameAvailable(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  name: string,
  scope: { kind: "shared" } | { kind: "personal"; ownerId: Id<"users"> },
  ignoreId?: Id<"inboxes">,
) {
  const sameName = await ctx.db
    .query("inboxes")
    .withIndex("by_workspaceId_and_name", (q) =>
      q.eq("workspaceId", workspaceId).eq("name", name),
    )
    .collect();
  const clash = sameName.some((inbox) => {
    if (inbox._id === ignoreId) return false;
    if (inboxKind(inbox) !== scope.kind) return false;
    return scope.kind === "shared" || inbox.ownerId === scope.ownerId;
  });
  if (clash) throw new Error(`An inbox named “${name}” already exists`);
}

function inboxScope(inbox: Doc<"inboxes">) {
  return inboxKind(inbox) === "personal"
    ? ({ kind: "personal", ownerId: inbox.ownerId! } as const)
    : ({ kind: "shared" } as const);
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
      const channels = await getInboxChannels(ctx, inbox._id);
      const channelSummaries = [];
      let threadCount = 0;
      for (const channel of channels) {
        const channelThreads = await ctx.db
          .query("threads")
          .withIndex("by_channelId_and_lastMessageAt", (q) =>
            q.eq("channelId", channel._id),
          )
          .collect();
        threadCount += channelThreads.length;
        const mailConnection =
          channel.provider === "gmail" || channel.provider === "outlook"
            ? await ctx.db
                .query("mailConnections")
                .withIndex("by_channelId", (q) => q.eq("channelId", channel._id))
                .unique()
            : null;
        channelSummaries.push({
          _id: channel._id,
          provider: channel.provider,
          address: channel.address,
          status: channel.status,
          threadCount: channelThreads.length,
          mailConnection: mailConnection
            ? {
                syncStatus: mailConnection.syncStatus,
                lastSyncedAt: mailConnection.lastSyncedAt ?? null,
                lastSyncError: mailConnection.lastSyncError ?? null,
              }
            : null,
        });
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
        canManage: canManageInbox(context.membership, inbox),
        threadCount,
        channels: channelSummaries,
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

/**
 * Creates the inbox members will connect channels to. Anyone may create a
 * personal inbox they alone see; shared inboxes are an admin decision.
 */
export const create = mutation({
  args: {
    name: v.string(),
    kind: v.union(v.literal("shared"), v.literal("personal")),
  },
  returns: v.id("inboxes"),
  handler: async (ctx, args) => {
    const context = await requireWorkspaceContext(ctx);
    if (args.kind === "shared" && context.membership.role !== "admin") {
      throw new Error("Only a workspace admin can create shared inboxes");
    }
    const name = normalizeInboxName(args.name);
    const scope =
      args.kind === "personal"
        ? ({ kind: "personal", ownerId: context.user._id } as const)
        : ({ kind: "shared" } as const);
    await requireNameAvailable(ctx, context.workspace._id, name, scope);
    return await ctx.db.insert("inboxes", {
      workspaceId: context.workspace._id,
      name,
      kind: args.kind,
      ownerId: args.kind === "personal" ? context.user._id : undefined,
    });
  },
});

export const rename = mutation({
  args: { inboxId: v.id("inboxes"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await requireWorkspaceContext(ctx);
    const inbox = await ctx.db.get(args.inboxId);
    if (!inbox || !canManageInbox(context.membership, inbox)) {
      throw new Error("Inbox not found");
    }
    const name = normalizeInboxName(args.name);
    await requireNameAvailable(
      ctx,
      inbox.workspaceId,
      name,
      inboxScope(inbox),
      inbox._id,
    );
    await ctx.db.patch(inbox._id, { name });
    return null;
  },
});

/**
 * Deletes an inbox with its channels and their conversations. Members keep at
 * least one personal inbox so they always have somewhere to work.
 */
export const remove = mutation({
  args: { inboxId: v.id("inboxes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await requireWorkspaceContext(ctx);
    const inbox = await ctx.db.get(args.inboxId);
    if (!inbox || !canManageInbox(context.membership, inbox)) {
      throw new Error("Inbox not found");
    }
    if (inboxKind(inbox) === "personal") {
      const owned = await ctx.db
        .query("inboxes")
        .withIndex("by_workspaceId_and_ownerId", (q) =>
          q.eq("workspaceId", inbox.workspaceId).eq("ownerId", context.user._id),
        )
        .collect();
      if (owned.length <= 1) {
        throw new Error("Your last personal inbox cannot be deleted");
      }
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

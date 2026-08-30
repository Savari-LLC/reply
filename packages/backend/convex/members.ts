import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireWorkspaceAdmin, requireWorkspaceContext } from "./authHelpers";
import { deleteInboxCascade } from "./lib/cascade";
import { isSeedUser } from "./seed";

const roleValidator = v.union(v.literal("admin"), v.literal("member"));

const memberValidator = v.object({
  userId: v.id("users"),
  name: v.string(),
  email: v.union(v.string(), v.null()),
  imageUrl: v.union(v.string(), v.null()),
  role: roleValidator,
  isSelf: v.boolean(),
  isDemo: v.boolean(),
});

function displayName(user: Doc<"users">) {
  return user.name ?? user.username ?? "Teammate";
}

async function requireTargetMembership(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">,
): Promise<Doc<"memberships">> {
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_workspaceId_and_userId", (q) =>
      q.eq("workspaceId", workspaceId).eq("userId", userId),
    )
    .unique();
  if (!membership) throw new Error("This person is not in your workspace");
  return membership;
}

async function countAdmins(ctx: MutationCtx, workspaceId: Id<"workspaces">) {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  return memberships.filter((membership) => membership.role === "admin").length;
}

export const list = query({
  args: {},
  returns: v.array(memberValidator),
  handler: async (ctx) => {
    const context = await requireWorkspaceContext(ctx);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", context.workspace._id))
      .collect();
    const members = [];
    for (const membership of memberships) {
      const user = await ctx.db.get(membership.userId);
      if (!user) continue;
      members.push({
        userId: user._id,
        name: displayName(user),
        email: user.email ?? null,
        imageUrl: user.authProvider === "google" ? (user.image ?? null) : null,
        role: membership.role,
        isSelf: user._id === context.user._id,
        isDemo: isSeedUser(user),
      });
    }
    // Admins first, then alphabetically; the caller floats to the top.
    members.sort((a, b) => {
      if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
      if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return members;
  },
});

export const setRole = mutation({
  args: { userId: v.id("users"), role: roleValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await requireWorkspaceAdmin(ctx);
    const target = await requireTargetMembership(ctx, context.workspace._id, args.userId);
    if (target.role === args.role) return null;
    if (
      target.role === "admin" &&
      (await countAdmins(ctx, context.workspace._id)) <= 1
    ) {
      throw new Error("A workspace needs at least one admin");
    }
    await ctx.db.patch(target._id, { role: args.role });
    return null;
  },
});

export const remove = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await requireWorkspaceAdmin(ctx);
    if (args.userId === context.user._id) {
      throw new Error("You cannot remove yourself from the workspace");
    }
    const target = await requireTargetMembership(ctx, context.workspace._id, args.userId);
    if (
      target.role === "admin" &&
      (await countAdmins(ctx, context.workspace._id)) <= 1
    ) {
      throw new Error("A workspace needs at least one admin");
    }

    // Unassign their conversations so the queue stays actionable.
    const assigned = await ctx.db
      .query("threads")
      .withIndex("by_workspaceId_and_assigneeId_and_status_and_lastMessageAt", (q) =>
        q.eq("workspaceId", context.workspace._id).eq("assigneeId", args.userId),
      )
      .collect();
    for (const thread of assigned) {
      await ctx.db.patch(thread._id, { assigneeId: undefined });
    }

    // Their personal inbox (and its channels and threads) leaves with them.
    const personalInboxes = await ctx.db
      .query("inboxes")
      .withIndex("by_workspaceId_and_ownerId", (q) =>
        q.eq("workspaceId", context.workspace._id).eq("ownerId", args.userId),
      )
      .collect();
    for (const inbox of personalInboxes) await deleteInboxCascade(ctx, inbox);

    const grants = await ctx.db
      .query("inboxAccess")
      .withIndex("by_workspaceId_and_userId", (q) =>
        q.eq("workspaceId", context.workspace._id).eq("userId", args.userId),
      )
      .collect();
    for (const grant of grants) await ctx.db.delete(grant._id);

    const reads = await ctx.db
      .query("threadReads")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", args.userId).eq("workspaceId", context.workspace._id),
      )
      .collect();
    for (const read of reads) await ctx.db.delete(read._id);

    await ctx.db.delete(target._id);
    const user = await ctx.db.get(args.userId);
    if (user && isSeedUser(user)) {
      await ctx.db.delete(user._id);
    }
    return null;
  },
});

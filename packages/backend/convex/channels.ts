import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { requireWorkspaceContext, type WorkspaceContext } from "./authHelpers";
import { deleteChannelCascade } from "./lib/cascade";
import { connectSampleData, sampleDatasetValidator } from "./seed";
import { inboxKind } from "./lib/access";

/** Owners manage their personal inbox; admins manage shared inboxes. */
function requireChannelManagement(context: WorkspaceContext, inbox: Doc<"inboxes">) {
  if (inbox.workspaceId !== context.workspace._id) {
    throw new Error("Inbox not found");
  }
  const canManage =
    inboxKind(inbox) === "personal"
      ? inbox.ownerId === context.user._id
      : context.membership.role === "admin";
  if (!canManage) {
    throw new Error("Only a workspace admin can manage channels on this inbox");
  }
}

export const connect = mutation({
  args: {
    inboxId: v.id("inboxes"),
    provider: v.union(v.literal("gmail"), v.literal("outlook"), v.literal("demo")),
    dataset: v.optional(sampleDatasetValidator),
  },
  returns: v.id("channels"),
  handler: async (ctx, args) => {
    const context = await requireWorkspaceContext(ctx);
    const inbox = await ctx.db.get(args.inboxId);
    if (!inbox) throw new Error("Inbox not found");
    requireChannelManagement(context, inbox);
    if (args.provider === "gmail") {
      throw new Error("Gmail connections are coming soon");
    }
    if (args.provider === "outlook") {
      throw new Error("Outlook connections are coming soon");
    }
    const dataset = args.dataset ?? "sales";
    const existing = await ctx.db
      .query("channels")
      .withIndex("by_inboxId", (q) => q.eq("inboxId", inbox._id))
      .collect();
    if (existing.some((channel) => channel.provider === "demo")) {
      throw new Error("Sample data is already connected to this inbox");
    }
    const result = await connectSampleData(ctx, {
      workspaceId: context.workspace._id,
      inboxId: inbox._id,
      actorId: context.user._id,
      dataset,
    });
    return result.channelId;
  },
});

export const disconnect = mutation({
  args: { channelId: v.id("channels") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await requireWorkspaceContext(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel || channel.workspaceId !== context.workspace._id) {
      throw new Error("Channel not found");
    }
    const inbox = await ctx.db.get(channel.inboxId);
    if (!inbox) throw new Error("Inbox not found");
    requireChannelManagement(context, inbox);
    // Demo channels take their sample conversations with them; real
    // providers will archive instead once they exist.
    await deleteChannelCascade(ctx, channel);
    return null;
  },
});

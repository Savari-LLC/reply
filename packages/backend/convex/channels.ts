import { v } from "convex/values";

import { mutation } from "./_generated/server";
import { requireWorkspaceContext } from "./authHelpers";
import { canManageInbox, requireManageableChannelInbox } from "./lib/access";
import { deleteChannelCascade } from "./lib/cascade";
import { channelProviderValidator, normalizeChannelAddress } from "./lib/providers";

/**
 * Connects a simulated channel to an inbox the caller manages. There is no
 * standalone channel: the inbox is the only container, so the channel
 * inherits its visibility and access. Conversations arrive through simulated
 * incoming messages rather than imported sample data.
 */
export const connect = mutation({
  args: {
    inboxId: v.id("inboxes"),
    provider: channelProviderValidator,
    address: v.string(),
  },
  returns: v.id("channels"),
  handler: async (ctx, args) => {
    const context = await requireWorkspaceContext(ctx);
    const inbox = await ctx.db.get(args.inboxId);
    if (!inbox || !canManageInbox(context.membership, inbox)) {
      throw new Error("Inbox not found");
    }
    const address = normalizeChannelAddress(args.provider, args.address);
    const duplicate = await ctx.db
      .query("channels")
      .withIndex("by_workspaceId_and_address", (q) =>
        q.eq("workspaceId", context.workspace._id).eq("address", address),
      )
      .first();
    if (duplicate) {
      throw new Error(`${address} is already connected in this workspace`);
    }
    return await ctx.db.insert("channels", {
      workspaceId: context.workspace._id,
      inboxId: inbox._id,
      provider: args.provider,
      address,
      status: "connected",
    });
  },
});

/** Disconnects a channel, removing its conversations from the inbox. */
export const disconnect = mutation({
  args: { channelId: v.id("channels") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await requireWorkspaceContext(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel || channel.workspaceId !== context.workspace._id) {
      throw new Error("Channel not found");
    }
    await requireManageableChannelInbox(ctx, context.membership, channel);
    const mailConnection = await ctx.db
      .query("mailConnections")
      .withIndex("by_channelId", (q) => q.eq("channelId", channel._id))
      .unique();
    if (mailConnection) {
      throw new Error("Disconnect this mailbox through the mail channel controls");
    }
    await deleteChannelCascade(ctx, channel);
    return null;
  },
});

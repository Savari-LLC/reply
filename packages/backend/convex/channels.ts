import { v } from "convex/values";

import { internal } from "./_generated/api";
import { mutation } from "./_generated/server";
import { requireWorkspaceContext } from "./authHelpers";
import { canManageInbox, requireManageableChannelInbox } from "./lib/access";
import { deleteChannelCascade } from "./lib/cascade";
import {
  channelProviderValidator,
  normalizeChannelAddress,
  type ChannelProvider,
} from "./lib/providers";
import { buildSeedThreads, ENRICHED_SEED_DOMAINS } from "./mailSeed";

const DEMO_MAILBOX_DOMAIN = "reply.example";

function isDemoGmailAddress(provider: ChannelProvider, address: string) {
  return provider === "gmail" && address.endsWith(`@${DEMO_MAILBOX_DOMAIN}`);
}

/**
 * Connects a channel to an inbox the caller manages. Reserved Gmail aliases
 * import the hackathon dataset without requesting Google account access; other
 * simulated channels start empty and receive messages through the preview flow.
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
    const channelId = await ctx.db.insert("channels", {
      workspaceId: context.workspace._id,
      inboxId: inbox._id,
      provider: args.provider,
      address,
      status: "connected",
    });
    if (!isDemoGmailAddress(args.provider, address)) return channelId;

    const threads = buildSeedThreads(address, Date.now());
    for (const thread of threads) {
      const senderEmail = thread.senderEmail.trim().toLowerCase();
      const senderDomain = senderEmail.split("@")[1] ?? "";
      const threadId = await ctx.db.insert("threads", {
        workspaceId: context.workspace._id,
        inboxId: inbox._id,
        channelId,
        externalThreadId: thread.externalThreadId,
        subject: thread.subject.slice(0, 500),
        status: "open",
        priority: "normal",
        senderName: thread.senderName.slice(0, 300),
        senderEmail,
        senderDomain,
        lastMessageAt: thread.lastMessageAt,
      });
      for (const message of thread.messages) {
        await ctx.db.insert("messages", {
          workspaceId: context.workspace._id,
          threadId,
          externalMessageId: message.externalMessageId,
          direction: message.direction,
          authorId: message.direction === "outbound" ? context.user._id : undefined,
          senderName:
            message.direction === "inbound" ? message.senderName.slice(0, 300) : undefined,
          senderEmail:
            message.direction === "inbound"
              ? message.senderEmail.trim().toLowerCase()
              : undefined,
          body: message.body.slice(0, 200_000),
          sentAt: message.sentAt,
        });
      }
      if (!thread.unread) {
        await ctx.db.insert("threadReads", {
          workspaceId: context.workspace._id,
          inboxId: inbox._id,
          threadId,
          userId: context.user._id,
          lastReadAt: thread.lastMessageAt,
        });
      }
    }

    for (const domain of ENRICHED_SEED_DOMAINS) {
      await ctx.scheduler.runAfter(0, internal.companyContext.enrichDomain, {
        workspaceId: context.workspace._id,
        domain,
      });
    }
    return channelId;
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

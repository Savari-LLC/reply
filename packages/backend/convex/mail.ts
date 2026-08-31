import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireWorkspaceContext } from "./authHelpers";
import { canManageInbox, requireManageableChannelInbox } from "./lib/access";
import schema from "./schema";

const providerValidator = v.union(v.literal("gmail"), v.literal("outlook"));
const AUTO_SYNC_DEBOUNCE_MS = 30_000;
const MAX_AUTOMATIC_SYNCS_PER_RUN = 50;
const MAX_WATCH_RENEWALS_PER_RUN = 25;
const importedMessageValidator = v.object({
  externalMessageId: v.string(),
  direction: v.union(v.literal("inbound"), v.literal("outbound")),
  senderName: v.string(),
  senderEmail: v.string(),
  body: v.string(),
  sentAt: v.number(),
});
const importedThreadValidator = v.object({
  externalThreadId: v.string(),
  subject: v.string(),
  senderName: v.string(),
  senderEmail: v.string(),
  lastMessageAt: v.number(),
  unread: v.boolean(),
  messages: v.array(importedMessageValidator),
});
const oauthStateResultValidator = v.object({
  workspaceId: v.id("workspaces"),
  inboxId: v.id("inboxes"),
  channelId: v.union(v.id("channels"), v.null()),
  userId: v.id("users"),
  provider: providerValidator,
  codeVerifierEncrypted: v.string(),
});
const syncContextValidator = v.object({
  connection: schema.doc("mailConnections"),
  channel: schema.doc("channels"),
});

type DatabaseCtx = QueryCtx | MutationCtx;

async function userFromSubject(ctx: DatabaseCtx, subject: string) {
  const userId = ctx.db.normalizeId("users", subject);
  const user = userId ? await ctx.db.get(userId) : null;
  if (!user) throw new Error("Your account could not be found");
  return user;
}

async function workspaceFromSubject(ctx: DatabaseCtx, subject: string) {
  const user = await userFromSubject(ctx, subject);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .unique();
  if (!membership) throw new Error("Join a workspace to continue");
  const workspace = await ctx.db.get(membership.workspaceId);
  if (!workspace) throw new Error("Workspace not found");
  if (workspace.demoSeed === true) {
    throw new Error("Live mailbox connections are disabled for the demo workspace");
  }
  return { user, membership, workspace };
}

export const prepareOauth = internalMutation({
  args: {
    actorSubject: v.string(),
    inboxId: v.id("inboxes"),
    channelId: v.optional(v.id("channels")),
    provider: providerValidator,
    stateHash: v.string(),
    codeVerifierEncrypted: v.string(),
    expiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await workspaceFromSubject(ctx, args.actorSubject);
    const inbox = await ctx.db.get(args.inboxId);
    if (!inbox || !canManageInbox(context.membership, inbox)) {
      throw new Error("Inbox not found");
    }
    if (args.channelId) {
      const channel = await ctx.db.get(args.channelId);
      if (
        !channel ||
        channel.inboxId !== inbox._id ||
        channel.provider !== args.provider
      ) {
        throw new Error("Channel not found");
      }
    }
    const stateCollision = await ctx.db
      .query("mailOauthStates")
      .withIndex("by_stateHash", (q) => q.eq("stateHash", args.stateHash))
      .first();
    if (stateCollision) throw new Error("Could not create a unique mailbox connection state");
    const previousStates = await ctx.db
      .query("mailOauthStates")
      .withIndex("by_userId", (q) => q.eq("userId", context.user._id))
      .take(10);
    for (const previousState of previousStates) {
      await ctx.db.delete(previousState._id);
    }
    await ctx.db.insert("mailOauthStates", {
      stateHash: args.stateHash,
      codeVerifierEncrypted: args.codeVerifierEncrypted,
      workspaceId: context.workspace._id,
      inboxId: inbox._id,
      channelId: args.channelId,
      userId: context.user._id,
      provider: args.provider,
      expiresAt: args.expiresAt,
    });
    return null;
  },
});

export const consumeOauthState = internalMutation({
  args: { stateHash: v.string(), now: v.number() },
  returns: oauthStateResultValidator,
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("mailOauthStates")
      .withIndex("by_stateHash", (q) => q.eq("stateHash", args.stateHash))
      .unique();
    if (!state) throw new Error("This mailbox connection request is invalid or already used");
    if (state.expiresAt < args.now) throw new Error("This mailbox connection request has expired");
    await ctx.db.delete(state._id);
    return {
      workspaceId: state.workspaceId,
      inboxId: state.inboxId,
      channelId: state.channelId ?? null,
      userId: state.userId,
      provider: state.provider,
      codeVerifierEncrypted: state.codeVerifierEncrypted,
    };
  },
});

export const completeOauth = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    inboxId: v.id("inboxes"),
    channelId: v.union(v.id("channels"), v.null()),
    userId: v.id("users"),
    provider: providerValidator,
    providerAccountId: v.string(),
    emailAddress: v.string(),
    accessTokenEncrypted: v.string(),
    refreshTokenEncrypted: v.optional(v.string()),
    accessTokenExpiresAt: v.number(),
    scope: v.string(),
  },
  returns: v.object({
    connectionId: v.id("mailConnections"),
    channelId: v.id("channels"),
  }),
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.demoSeed === true) {
      throw new Error("Live mailbox connections are disabled for the demo workspace");
    }
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_workspaceId_and_userId", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId),
      )
      .unique();
    const inbox = await ctx.db.get(args.inboxId);
    if (!membership || !inbox || !canManageInbox(membership, inbox)) {
      throw new Error("You no longer have permission to connect this mailbox");
    }

    let channel: Doc<"channels"> | null = null;
    let connection: Doc<"mailConnections"> | null = null;
    if (args.channelId) {
      channel = await ctx.db.get(args.channelId);
      if (
        !channel ||
        channel.inboxId !== inbox._id ||
        channel.provider !== args.provider
      ) {
        throw new Error("You no longer have permission to reconnect this channel");
      }
      connection = await ctx.db
        .query("mailConnections")
        .withIndex("by_channelId", (q) => q.eq("channelId", channel!._id))
        .unique();
    } else {
      connection = await ctx.db
        .query("mailConnections")
        .withIndex("by_workspaceId_and_provider_and_providerAccountId", (q) =>
          q
            .eq("workspaceId", workspace._id)
            .eq("provider", args.provider)
            .eq("providerAccountId", args.providerAccountId),
        )
        .unique();
      if (connection) {
        channel = await ctx.db.get(connection.channelId);
        if (!channel || channel.inboxId !== inbox._id) {
          throw new Error("This mailbox is already connected to another inbox");
        }
      }
    }

    const now = Date.now();
    if (!channel) {
      const duplicate = await ctx.db
        .query("channels")
        .withIndex("by_workspaceId_and_address", (q) =>
          q.eq("workspaceId", workspace._id).eq("address", args.emailAddress),
        )
        .first();
      if (duplicate) throw new Error(`${args.emailAddress} is already connected in this workspace`);
      const channelId = await ctx.db.insert("channels", {
        workspaceId: workspace._id,
        inboxId: inbox._id,
        provider: args.provider,
        address: args.emailAddress,
        status: "connected",
      });
      channel = (await ctx.db.get(channelId))!;
    } else {
      await ctx.db.patch(channel._id, {
        address: args.emailAddress,
        status: "connected",
      });
    }

    if (connection) {
      await ctx.db.patch(connection._id, {
        connectedBy: args.userId,
        provider: args.provider,
        providerAccountId: args.providerAccountId,
        emailAddress: args.emailAddress,
        accessTokenEncrypted: args.accessTokenEncrypted,
        refreshTokenEncrypted:
          args.refreshTokenEncrypted ??
          (connection.provider === args.provider &&
          connection.providerAccountId === args.providerAccountId
            ? connection.refreshTokenEncrypted
            : undefined),
        accessTokenExpiresAt: args.accessTokenExpiresAt,
        scope: args.scope,
        status: "connected",
        syncStatus: "idle",
        lastSyncError: undefined,
        gmailHistoryId: undefined,
        gmailWatchExpirationAt: undefined,
        gmailWatchError: undefined,
        nextAutoSyncAt: undefined,
        updatedAt: now,
      });
      return { connectionId: connection._id, channelId: channel._id };
    }

    const connectionId = await ctx.db.insert("mailConnections", {
      workspaceId: workspace._id,
      inboxId: inbox._id,
      channelId: channel._id,
      connectedBy: args.userId,
      provider: args.provider,
      providerAccountId: args.providerAccountId,
      emailAddress: args.emailAddress,
      accessTokenEncrypted: args.accessTokenEncrypted,
      refreshTokenEncrypted: args.refreshTokenEncrypted,
      accessTokenExpiresAt: args.accessTokenExpiresAt,
      scope: args.scope,
      status: "connected",
      syncStatus: "idle",
      createdAt: now,
      updatedAt: now,
    });
    return { connectionId, channelId: channel._id };
  },
});

export const getConnectionForSync = internalQuery({
  args: {
    channelId: v.id("channels"),
    actorSubject: v.optional(v.string()),
  },
  returns: syncContextValidator,
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Mailbox channel not found");
    const workspace = await ctx.db.get(channel.workspaceId);
    if (!workspace || workspace.demoSeed === true) {
      throw new Error("Live mailbox connections are disabled for the demo workspace");
    }
    if (args.actorSubject !== undefined) {
      const context = await workspaceFromSubject(ctx, args.actorSubject);
      if (context.workspace._id !== workspace._id) throw new Error("Channel not found");
      await requireManageableChannelInbox(ctx, context.membership, channel);
    }
    const connection = await ctx.db
      .query("mailConnections")
      .withIndex("by_channelId", (q) => q.eq("channelId", channel._id))
      .unique();
    if (connection?.status !== "connected" || !connection.accessTokenEncrypted) {
      throw new Error("Reconnect this mailbox before syncing");
    }
    return { connection, channel };
  },
});

async function scheduleConnectionSync(
  ctx: MutationCtx,
  connection: Doc<"mailConnections">,
  now: number,
  delayMs: number,
) {
  if (connection.status !== "connected") return false;
  if (connection.nextAutoSyncAt !== undefined && connection.nextAutoSyncAt > now) return false;
  const effectiveDelay =
    connection.syncStatus === "syncing" && connection.updatedAt > now - 10 * 60 * 1000
      ? Math.max(delayMs, 10_000)
      : delayMs;
  await ctx.scheduler.runAfter(effectiveDelay, internal.mailActions.syncConnectedChannel, {
    channelId: connection.channelId,
  });
  await ctx.db.patch(connection._id, { nextAutoSyncAt: now + AUTO_SYNC_DEBOUNCE_MS });
  return true;
}

export const queueGmailPushSync = internalMutation({
  args: {
    emailAddress: v.string(),
    historyId: v.string(),
    now: v.number(),
  },
  returns: v.object({ matched: v.number(), scheduled: v.number() }),
  handler: async (ctx, args) => {
    const emailAddress = args.emailAddress.trim().toLowerCase();
    const connections = await ctx.db
      .query("mailConnections")
      .withIndex("by_provider_and_emailAddress", (q) =>
        q.eq("provider", "gmail").eq("emailAddress", emailAddress),
      )
      .take(10);
    let matched = 0;
    let scheduled = 0;
    for (const connection of connections) {
      if (connection.status !== "connected") continue;
      matched += 1;
      await ctx.db.patch(connection._id, { gmailHistoryId: args.historyId });
      if (await scheduleConnectionSync(ctx, connection, args.now, 0)) scheduled += 1;
    }
    return { matched, scheduled };
  },
});

export const scheduleGmailFallbackSyncs = internalMutation({
  args: { now: v.optional(v.number()) },
  returns: v.number(),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const connections = await ctx.db
      .query("mailConnections")
      .withIndex("by_provider_and_status", (q) =>
        q.eq("provider", "gmail").eq("status", "connected"),
      )
      .take(MAX_AUTOMATIC_SYNCS_PER_RUN);
    let scheduled = 0;
    for (const connection of connections) {
      if (await scheduleConnectionSync(ctx, connection, now, scheduled * 250)) {
        scheduled += 1;
      }
    }
    return scheduled;
  },
});

export const scheduleGmailWatchRenewals = internalMutation({
  args: { now: v.optional(v.number()) },
  returns: v.number(),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const renewBefore = now + 24 * 60 * 60 * 1000;
    const connections = await ctx.db
      .query("mailConnections")
      .withIndex("by_provider_and_status", (q) =>
        q.eq("provider", "gmail").eq("status", "connected"),
      )
      .take(100);
    let scheduled = 0;
    for (const connection of connections) {
      if (
        connection.gmailWatchExpirationAt === undefined ||
        connection.gmailWatchExpirationAt <= renewBefore
      ) {
        await ctx.scheduler.runAfter(
          scheduled * 250,
          internal.mailActions.configureGmailWatch,
          { channelId: connection.channelId },
        );
        scheduled += 1;
        if (scheduled === MAX_WATCH_RENEWALS_PER_RUN) break;
      }
    }
    return scheduled;
  },
});

export const recordGmailWatch = internalMutation({
  args: {
    connectionId: v.id("mailConnections"),
    historyId: v.string(),
    expirationAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection || connection.provider !== "gmail" || connection.status !== "connected") {
      throw new Error("Gmail connection is not active");
    }
    await ctx.db.patch(connection._id, {
      gmailHistoryId: args.historyId,
      gmailWatchExpirationAt: args.expirationAt,
      gmailWatchError: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const failGmailWatch = internalMutation({
  args: { connectionId: v.id("mailConnections"), message: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection || connection.provider !== "gmail") return null;
    await ctx.db.patch(connection._id, {
      gmailWatchError: args.message.slice(0, 300),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const markSyncStarted = internalMutation({
  args: { connectionId: v.id("mailConnections"), now: v.optional(v.number()) },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection || connection.status !== "connected") {
      throw new Error("Mailbox connection is not active");
    }
    const now = args.now ?? Date.now();
    if (connection.syncStatus === "syncing" && connection.updatedAt > now - 10 * 60 * 1000) {
      return false;
    }
    await ctx.db.patch(connection._id, {
      syncStatus: "syncing",
      lastSyncError: undefined,
      updatedAt: now,
    });
    return true;
  },
});

export const updateTokens = internalMutation({
  args: {
    connectionId: v.id("mailConnections"),
    accessTokenEncrypted: v.string(),
    refreshTokenEncrypted: v.optional(v.string()),
    accessTokenExpiresAt: v.number(),
    scope: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection) throw new Error("Mailbox connection not found");
    await ctx.db.patch(connection._id, {
      accessTokenEncrypted: args.accessTokenEncrypted,
      refreshTokenEncrypted: args.refreshTokenEncrypted ?? connection.refreshTokenEncrypted,
      accessTokenExpiresAt: args.accessTokenExpiresAt,
      scope: args.scope,
      status: "connected",
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const upsertImportedThread = internalMutation({
  args: {
    connectionId: v.id("mailConnections"),
    thread: importedThreadValidator,
  },
  returns: v.object({ insertedThread: v.boolean(), insertedMessages: v.number() }),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection || connection.status !== "connected") {
      throw new Error("Mailbox connection is not active");
    }
    const channel = await ctx.db.get(connection.channelId);
    if (!channel || channel.workspaceId !== connection.workspaceId) {
      throw new Error("Mailbox channel is invalid");
    }
    const senderEmail = args.thread.senderEmail.trim().toLowerCase();
    const senderDomain = senderEmail.split("@")[1] ?? "";
    const existingThread = await ctx.db
      .query("threads")
      .withIndex("by_channelId_and_externalThreadId", (q) =>
        q
          .eq("channelId", connection.channelId)
          .eq("externalThreadId", args.thread.externalThreadId),
      )
      .unique();
    const threadId = existingThread
      ? existingThread._id
      : await ctx.db.insert("threads", {
          workspaceId: connection.workspaceId,
          inboxId: channel.inboxId,
          channelId: connection.channelId,
          externalThreadId: args.thread.externalThreadId,
          subject: args.thread.subject.slice(0, 500),
          status: "open",
          priority: "normal",
          senderName: args.thread.senderName.slice(0, 300),
          senderEmail,
          senderDomain,
          lastMessageAt: args.thread.lastMessageAt,
        });
    if (existingThread) {
      await ctx.db.patch(existingThread._id, {
        inboxId: channel.inboxId,
        subject: args.thread.subject.slice(0, 500),
        senderName: args.thread.senderName.slice(0, 300),
        senderEmail,
        senderDomain,
        lastMessageAt: args.thread.lastMessageAt,
      });
    }
    let insertedMessages = 0;
    for (const message of args.thread.messages.slice(-100)) {
      const existingMessage = await ctx.db
        .query("messages")
        .withIndex("by_threadId_and_externalMessageId", (q) =>
          q.eq("threadId", threadId).eq("externalMessageId", message.externalMessageId),
        )
        .unique();
      const record = {
        direction: message.direction,
        authorId: message.direction === "outbound" ? connection.connectedBy : undefined,
        senderName: message.direction === "inbound" ? message.senderName.slice(0, 300) : undefined,
        senderEmail:
          message.direction === "inbound" ? message.senderEmail.trim().toLowerCase() : undefined,
        body: message.body.slice(0, 200_000),
        sentAt: message.sentAt,
      };
      if (existingMessage) {
        await ctx.db.patch(existingMessage._id, record);
      } else {
        await ctx.db.insert("messages", {
          workspaceId: connection.workspaceId,
          threadId,
          externalMessageId: message.externalMessageId,
          ...record,
        });
        insertedMessages += 1;
      }
    }
    const read = await ctx.db
      .query("threadReads")
      .withIndex("by_userId_and_threadId", (q) =>
        q.eq("userId", connection.connectedBy).eq("threadId", threadId),
      )
      .unique();
    if (args.thread.unread) {
      if (read) await ctx.db.delete(read._id);
    } else if (read) {
      await ctx.db.patch(read._id, { lastReadAt: args.thread.lastMessageAt });
    } else {
      await ctx.db.insert("threadReads", {
        workspaceId: connection.workspaceId,
        inboxId: channel.inboxId,
        threadId,
        userId: connection.connectedBy,
        lastReadAt: args.thread.lastMessageAt,
      });
    }
    return { insertedThread: existingThread === null, insertedMessages };
  },
});

export const finishSync = internalMutation({
  args: { connectionId: v.id("mailConnections"), syncedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection) throw new Error("Mailbox connection not found");
    await ctx.db.patch(connection._id, {
      syncStatus: "idle",
      lastSyncedAt: args.syncedAt,
      lastSyncError: undefined,
      nextAutoSyncAt: undefined,
      updatedAt: args.syncedAt,
    });
    return null;
  },
});

export const failSync = internalMutation({
  args: { connectionId: v.id("mailConnections"), message: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection) return null;
    await ctx.db.patch(connection._id, {
      syncStatus: "error",
      lastSyncError: args.message.slice(0, 300),
      nextAutoSyncAt: undefined,
      updatedAt: Date.now(),
    });
    return null;
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
    await requireManageableChannelInbox(ctx, context.membership, channel);
    const connection = await ctx.db
      .query("mailConnections")
      .withIndex("by_channelId", (q) => q.eq("channelId", channel._id))
      .unique();
    if (!connection) return null;
    await ctx.db.patch(channel._id, { status: "disconnected" });
    await ctx.db.patch(connection._id, {
      accessTokenEncrypted: undefined,
      refreshTokenEncrypted: undefined,
      status: "disconnected",
      syncStatus: "idle",
      lastSyncError: undefined,
      gmailWatchExpirationAt: undefined,
      gmailWatchError: undefined,
      nextAutoSyncAt: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

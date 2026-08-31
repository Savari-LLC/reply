import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import { requireIdentity } from "./authHelpers";
import { registerGmailWatch } from "./gmailPush";
import {
  authorizationUrl,
  decryptSecret,
  encryptSecret,
  fetchMailboxThreads,
  hashToken,
  pkceChallenge,
  providerConfiguration,
  randomToken,
  refreshAccessToken,
  type MailProvider,
} from "./mailProvider";

const providerValidator = v.union(v.literal("gmail"), v.literal("outlook"));
const syncResultValidator = v.object({
  threads: v.number(),
  insertedThreads: v.number(),
  insertedMessages: v.number(),
});

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Mailbox sync failed";
}

export const startOauth = action({
  args: {
    inboxId: v.id("inboxes"),
    channelId: v.optional(v.id("channels")),
    provider: providerValidator,
  },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    providerConfiguration(args.provider);
    const state = randomToken();
    const verifier = randomToken(48);
    const [stateHash, challenge, codeVerifierEncrypted] = await Promise.all([
      hashToken(state),
      pkceChallenge(verifier),
      encryptSecret(verifier),
    ]);
    await ctx.runMutation(internal.mail.prepareOauth, {
      actorSubject: identity.subject,
      inboxId: args.inboxId,
      channelId: args.channelId,
      provider: args.provider,
      stateHash,
      codeVerifierEncrypted,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    return { url: authorizationUrl(args.provider, state, challenge) };
  },
});

async function accessTokenForConnection(
  ctx: ActionCtx,
  connection: Doc<"mailConnections">,
) {
  let accessToken = await decryptSecret(connection.accessTokenEncrypted!);
  if (connection.accessTokenExpiresAt > Date.now() + 60_000) return accessToken;
  if (!connection.refreshTokenEncrypted) {
    throw new Error("The mailbox session expired. Reconnect the mailbox to continue.");
  }
  const refreshToken = await decryptSecret(connection.refreshTokenEncrypted);
  const refreshed = await refreshAccessToken(connection.provider as MailProvider, refreshToken);
  accessToken = refreshed.accessToken;
  await ctx.runMutation(internal.mail.updateTokens, {
    connectionId: connection._id,
    accessTokenEncrypted: await encryptSecret(refreshed.accessToken),
    refreshTokenEncrypted: refreshed.refreshToken
      ? await encryptSecret(refreshed.refreshToken)
      : undefined,
    accessTokenExpiresAt: refreshed.expiresAt,
    scope: refreshed.scope,
  });
  return accessToken;
}

async function runSync(
  ctx: ActionCtx,
  channelId: Id<"channels">,
  actorSubject?: string,
) {
  const { connection } = await ctx.runQuery(internal.mail.getConnectionForSync, {
    channelId,
    actorSubject,
  });
  const started: boolean = await ctx.runMutation(internal.mail.markSyncStarted, {
    connectionId: connection._id,
  });
  if (!started) return { threads: 0, insertedThreads: 0, insertedMessages: 0 };
  try {
    const accessToken = await accessTokenForConnection(ctx, connection);
    const threads = await fetchMailboxThreads(
      connection.provider as MailProvider,
      accessToken,
      connection.emailAddress,
    );
    let insertedThreads = 0;
    let insertedMessages = 0;
    for (const thread of threads) {
      const result: { insertedThread: boolean; insertedMessages: number } = await ctx.runMutation(
        internal.mail.upsertImportedThread,
        { connectionId: connection._id, thread },
      );
      if (result.insertedThread) insertedThreads += 1;
      insertedMessages += result.insertedMessages;
    }
    await ctx.runMutation(internal.mail.finishSync, {
      connectionId: connection._id,
      syncedAt: Date.now(),
    });
    return { threads: threads.length, insertedThreads, insertedMessages };
  } catch (error) {
    const message = errorMessage(error);
    await ctx.runMutation(internal.mail.failSync, {
      connectionId: connection._id,
      message,
    });
    throw new Error(message);
  }
}

async function configureGmailWatchForChannel(ctx: ActionCtx, channelId: Id<"channels">) {
  const syncContext: {
    connection: Doc<"mailConnections">;
    channel: Doc<"channels">;
  } = await ctx.runQuery(internal.mail.getConnectionForSync, { channelId });
  if (syncContext.connection.provider !== "gmail") return false;
  try {
    const accessToken = await accessTokenForConnection(ctx, syncContext.connection);
    const watch = await registerGmailWatch(accessToken);
    await ctx.runMutation(internal.mail.recordGmailWatch, {
      connectionId: syncContext.connection._id,
      historyId: watch.historyId,
      expirationAt: watch.expirationAt,
    });
    return true;
  } catch (error) {
    await ctx.runMutation(internal.mail.failGmailWatch, {
      connectionId: syncContext.connection._id,
      message: errorMessage(error),
    });
    return false;
  }
}

export const syncNow = action({
  args: { channelId: v.id("channels") },
  returns: syncResultValidator,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    return await runSync(ctx, args.channelId, identity.subject);
  },
});

export const syncConnectedChannel = internalAction({
  args: { channelId: v.id("channels") },
  returns: syncResultValidator,
  handler: async (ctx, args) => await runSync(ctx, args.channelId),
});

export const configureGmailWatch = internalAction({
  args: { channelId: v.id("channels") },
  returns: v.boolean(),
  handler: async (ctx, args) => await configureGmailWatchForChannel(ctx, args.channelId),
});

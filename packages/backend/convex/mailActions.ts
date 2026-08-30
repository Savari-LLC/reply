import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import { requireIdentity } from "./authHelpers";
import {
  authorizationUrl,
  encryptSecret,
  hashToken,
  pkceChallenge,
  providerConfiguration,
  randomToken,
} from "./mailProvider";
import { buildSeedThreads, ENRICHED_SEED_DOMAINS } from "./mailSeed";

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

async function runSync(
  ctx: ActionCtx,
  channelId: Id<"channels">,
  actorSubject?: string,
) {
  const { connection } = await ctx.runQuery(internal.mail.getConnectionForSync, {
    channelId,
    actorSubject,
  });
  await ctx.runMutation(internal.mail.markSyncStarted, { connectionId: connection._id });
  try {
    // Hackathon mode: the live provider fetch is disabled. We seed demo
    // threads instead so a freshly connected mailbox has data immediately.
    const threads = buildSeedThreads(connection.emailAddress, Date.now());
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
    // Enrich the seeded senders that write from real company domains so their
    // Context.dev company profiles are ready when the operator opens a thread.
    const seededDomains = new Set(
      threads
        .map((thread) => thread.senderEmail.split("@")[1] ?? "")
        .filter((domain) => ENRICHED_SEED_DOMAINS.includes(domain)),
    );
    for (const domain of seededDomains) {
      await ctx.scheduler.runAfter(0, internal.companyContext.enrichDomain, {
        workspaceId: connection.workspaceId,
        domain,
      });
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

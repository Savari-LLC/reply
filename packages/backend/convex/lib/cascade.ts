import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

async function deleteThreadCascade(ctx: MutationCtx, thread: Doc<"threads">) {
  const threadMessages = await ctx.db
    .query("messages")
    .withIndex("by_threadId_and_sentAt", (q) => q.eq("threadId", thread._id))
    .collect();
  for (const message of threadMessages) await ctx.db.delete(message._id);
  const threadNotes = await ctx.db
    .query("notes")
    .withIndex("by_threadId", (q) => q.eq("threadId", thread._id))
    .collect();
  for (const note of threadNotes) {
    const noteMentions = await ctx.db
      .query("mentions")
      .withIndex("by_noteId", (q) => q.eq("noteId", note._id))
      .collect();
    for (const mention of noteMentions) await ctx.db.delete(mention._id);
    await ctx.db.delete(note._id);
  }
  const reads = await ctx.db
    .query("threadReads")
    .withIndex("by_threadId", (q) => q.eq("threadId", thread._id))
    .collect();
  for (const read of reads) await ctx.db.delete(read._id);
  const links = await ctx.db
    .query("threadLabels")
    .withIndex("by_threadId_and_labelId", (q) => q.eq("threadId", thread._id))
    .collect();
  for (const link of links) await ctx.db.delete(link._id);
  await ctx.db.delete(thread._id);
}

/**
 * Disconnects a channel and deletes its conversations. Conversations live in
 * the channel, so they leave with it.
 */
export async function deleteChannelCascade(ctx: MutationCtx, channel: Doc<"channels">) {
  const channelThreads = await ctx.db
    .query("threads")
    .withIndex("by_channelId_and_lastMessageAt", (q) => q.eq("channelId", channel._id))
    .collect();
  for (const thread of channelThreads) await deleteThreadCascade(ctx, thread);
  const mailConnection = await ctx.db
    .query("mailConnections")
    .withIndex("by_channelId", (q) => q.eq("channelId", channel._id))
    .unique();
  if (mailConnection) await ctx.db.delete(mailConnection._id);
  await ctx.db.delete(channel._id);
}

/**
 * Deletes an inbox with the channels it owns, their conversations, and its
 * access grants. Nothing outlives the inbox.
 */
export async function deleteInboxCascade(ctx: MutationCtx, inbox: Doc<"inboxes">) {
  const channels = await ctx.db
    .query("channels")
    .withIndex("by_inboxId", (q) => q.eq("inboxId", inbox._id))
    .collect();
  for (const channel of channels) await deleteChannelCascade(ctx, channel);
  const grants = await ctx.db
    .query("inboxAccess")
    .withIndex("by_workspaceId_and_inboxId", (q) =>
      q.eq("workspaceId", inbox.workspaceId).eq("inboxId", inbox._id),
    )
    .collect();
  for (const grant of grants) await ctx.db.delete(grant._id);
  await ctx.db.delete(inbox._id);
}

import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireWorkspaceContext, type WorkspaceContext } from "./authHelpers";
import {
  canAccessInbox,
  ensurePersonalInbox,
  getInboxChannels,
  inboxKind,
} from "./lib/access";
import { avatarUrl, displayName } from "./lib/avatar";

async function isUnread(
  ctx: QueryCtx,
  actorId: Id<"users">,
  thread: Doc<"threads">,
): Promise<boolean> {
  const read = await ctx.db
    .query("threadReads")
    .withIndex("by_userId_and_threadId", (q) =>
      q.eq("userId", actorId).eq("threadId", thread._id),
    )
    .unique();
  return !read || read.lastReadAt < thread.lastMessageAt;
}

async function threadSummary(
  ctx: QueryCtx,
  actorId: Id<"users">,
  thread: Doc<"threads">,
  inboxId: Id<"inboxes"> | null,
) {
  const assignee = thread.assigneeId ? await ctx.db.get(thread.assigneeId) : null;
  const threadLabels = await ctx.db
    .query("threadLabels")
    .withIndex("by_threadId_and_labelId", (q) => q.eq("threadId", thread._id))
    .collect();
  const labels = (
    await Promise.all(threadLabels.map((tl) => ctx.db.get(tl.labelId)))
  ).flatMap((label) => (label ? [{ name: label.name, color: label.color }] : []));
  const [lastMessage] = await ctx.db
    .query("messages")
    .withIndex("by_threadId_and_sentAt", (q) => q.eq("threadId", thread._id))
    .order("desc")
    .take(1);
  const companyProfile = await ctx.db
    .query("companyProfiles")
    .withIndex("by_workspaceId_and_domain", (q) =>
      q.eq("workspaceId", thread.workspaceId).eq("domain", thread.senderDomain),
    )
    .unique();
  return {
    _id: thread._id,
    inboxId,
    subject: thread.subject,
    status: thread.status,
    priority: thread.priority,
    senderName: thread.senderName,
    senderEmail: thread.senderEmail,
    senderDomain: thread.senderDomain,
    lastMessageAt: thread.lastMessageAt,
    preview: lastMessage ? lastMessage.body.slice(0, 140) : "",
    assignee: assignee
      ? { _id: assignee._id, name: displayName(assignee) }
      : null,
    company: companyProfile
      ? { name: companyProfile.name, logoUrl: companyProfile.logoUrl ?? null }
      : null,
    labels,
    unread: await isUnread(ctx, actorId, thread),
  };
}

/** The thread's channel names its inbox, and the inbox decides access. */
async function threadInbox(
  ctx: QueryCtx,
  thread: Doc<"threads">,
): Promise<Doc<"inboxes"> | null> {
  const channel = await ctx.db.get(thread.channelId);
  return channel ? await ctx.db.get(channel.inboxId) : null;
}

async function canAccessThread(
  ctx: QueryCtx,
  context: WorkspaceContext,
  thread: Doc<"threads">,
): Promise<boolean> {
  if (thread.workspaceId !== context.workspace._id) return false;
  const inbox = await threadInbox(ctx, thread);
  return inbox !== null && (await canAccessInbox(ctx, context.membership, inbox));
}

async function requireThread(
  ctx: QueryCtx,
  context: WorkspaceContext,
  threadId: Id<"threads">,
): Promise<Doc<"threads">> {
  const thread = await ctx.db.get(threadId);
  if (!thread || !(await canAccessThread(ctx, context, thread))) {
    throw new Error("Conversation not found");
  }
  return thread;
}

async function threadsForInbox(
  ctx: QueryCtx,
  inboxId: Id<"inboxes">,
): Promise<Doc<"threads">[]> {
  const channels = await getInboxChannels(ctx, inboxId);
  const threads: Doc<"threads">[] = [];
  for (const channel of channels) {
    const channelThreads = await ctx.db
      .query("threads")
      .withIndex("by_channelId_and_lastMessageAt", (q) => q.eq("channelId", channel._id))
      .collect();
    threads.push(...channelThreads);
  }
  threads.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  return threads;
}

/**
 * Idempotent per-session setup: guarantees the signed-in member has a
 * personal inbox (covers workspaces created before personal inboxes existed).
 */
export const ensureSetup = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { user, workspace } = await requireWorkspaceContext(ctx);
    await ensurePersonalInbox(ctx, workspace._id, user._id);
    return null;
  },
});

export const listInboxes = query({
  args: {},
  handler: async (ctx) => {
    const context = await requireWorkspaceContext(ctx);
    const inboxes = await ctx.db
      .query("inboxes")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", context.workspace._id))
      .collect();
    const visible = [];
    for (const inbox of inboxes) {
      if (await canAccessInbox(ctx, context.membership, inbox)) visible.push(inbox);
    }
    // Personal inbox first, then shared inboxes in creation order.
    visible.sort((a, b) => {
      const aPersonal = inboxKind(a) === "personal" ? 0 : 1;
      const bPersonal = inboxKind(b) === "personal" ? 0 : 1;
      return aPersonal - bPersonal || a._creationTime - b._creationTime;
    });
    return await Promise.all(
      visible.map(async (inbox) => {
        const channels = await getInboxChannels(ctx, inbox._id);
        const inboxThreads = await threadsForInbox(ctx, inbox._id);
        let unreadCount = 0;
        for (const thread of inboxThreads) {
          if (await isUnread(ctx, context.user._id, thread)) unreadCount += 1;
        }
        return {
          _id: inbox._id,
          name: inbox.name,
          kind: inboxKind(inbox),
          channels: channels.map((channel) => ({
            _id: channel._id,
            provider: channel.provider,
            address: channel.address,
            status: channel.status,
          })),
          openCount: inboxThreads.filter((thread) => thread.status === "open").length,
          unreadCount,
        };
      }),
    );
  },
});

export const listThreads = query({
  args: {
    inboxId: v.id("inboxes"),
    status: v.optional(
      v.union(v.literal("open"), v.literal("waiting"), v.literal("closed")),
    ),
  },
  handler: async (ctx, args) => {
    const context = await requireWorkspaceContext(ctx);
    const inbox = await ctx.db.get(args.inboxId);
    if (!inbox || !(await canAccessInbox(ctx, context.membership, inbox))) {
      return null;
    }
    let threads = await threadsForInbox(ctx, inbox._id);
    if (args.status) {
      threads = threads.filter((thread) => thread.status === args.status);
    }
    return await Promise.all(
      threads.map((thread) => threadSummary(ctx, context.user._id, thread, inbox._id)),
    );
  },
});

export const getThread = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const context = await requireWorkspaceContext(ctx);
    const threadId = ctx.db.normalizeId("threads", args.threadId);
    if (!threadId) return null;
    const thread = await ctx.db.get(threadId);
    if (!thread || !(await canAccessThread(ctx, context, thread))) return null;
    const inbox = await threadInbox(ctx, thread);
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_threadId_and_sentAt", (q) => q.eq("threadId", thread._id))
      .order("asc")
      .collect();
    const companyProfile = await ctx.db
      .query("companyProfiles")
      .withIndex("by_workspaceId_and_domain", (q) =>
        q.eq("workspaceId", context.workspace._id).eq("domain", thread.senderDomain),
      )
      .unique();
    return {
      ...(await threadSummary(ctx, context.user._id, thread, inbox?._id ?? null)),
      inboxName: inbox?.name ?? "Inbox",
      companyProfile: companyProfile
        ? {
            name: companyProfile.name,
            description: companyProfile.description ?? null,
            industry: companyProfile.industry ?? null,
            website: companyProfile.website ?? null,
            logoUrl: companyProfile.logoUrl ?? null,
            slogan: companyProfile.slogan ?? null,
            primaryColor: companyProfile.primaryColor ?? null,
            location: companyProfile.location ?? null,
            email: companyProfile.email ?? null,
            phone: companyProfile.phone ?? null,
            socials: companyProfile.socials ?? [],
          }
        : null,
      messages: await Promise.all(
        messages.map(async (message) => {
          const author = message.authorId ? await ctx.db.get(message.authorId) : null;
          return {
            _id: message._id,
            direction: message.direction,
            body: message.body,
            sentAt: message.sentAt,
            senderName: message.senderName ?? null,
            author: author ? displayName(author) : null,
            authorImageUrl: author ? await avatarUrl(ctx, author) : null,
          };
        }),
      ),
      comments: await Promise.all(
        (
          await ctx.db
            .query("notes")
            .withIndex("by_threadId", (q) => q.eq("threadId", thread._id))
            .collect()
        ).map(async (note) => {
          const author = await ctx.db.get(note.authorId);
          const mentionRows = await ctx.db
            .query("mentions")
            .withIndex("by_noteId", (q) => q.eq("noteId", note._id))
            .collect();
          const mentions = await Promise.all(
            mentionRows.map(async (mention) => {
              const mentioned = await ctx.db.get(mention.mentionedUserId);
              return {
                userId: mention.mentionedUserId,
                name: mentioned ? displayName(mentioned) : "Teammate",
              };
            }),
          );
          const attachments = await Promise.all(
            (note.attachments ?? []).map(async (attachment) => ({
              url: await ctx.storage.getUrl(attachment.storageId),
              name: attachment.name,
              size: attachment.size,
              type: attachment.type,
            })),
          );
          return {
            _id: note._id,
            body: note.body,
            sentAt: note._creationTime,
            authorId: note.authorId,
            authorName: author ? displayName(author) : "Teammate",
            authorImageUrl: author ? await avatarUrl(ctx, author) : null,
            mentions,
            attachments: attachments.filter(
              (attachment): attachment is typeof attachment & { url: string } =>
                attachment.url !== null,
            ),
          };
        }),
      ),
    };
  },
});

const MAX_COMMENT_ATTACHMENTS = 5;

/** Short-lived URL the browser POSTs a comment attachment to. */
export const generateCommentUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireWorkspaceContext(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Internal comment on a thread; never sent to the customer. */
export const addComment = mutation({
  args: {
    threadId: v.id("threads"),
    body: v.string(),
    // Teammates tagged with "@" in the comment body.
    mentionedUserIds: v.optional(v.array(v.id("users"))),
    attachments: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          name: v.string(),
          size: v.number(),
          type: v.string(),
        }),
      ),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const body = args.body.trim();
    const attachments = args.attachments ?? [];
    if (body.length === 0 && attachments.length === 0) {
      throw new Error("Comment body cannot be empty");
    }
    if (attachments.length > MAX_COMMENT_ATTACHMENTS) {
      throw new Error(`Comments can include at most ${MAX_COMMENT_ATTACHMENTS} files`);
    }
    const context = await requireWorkspaceContext(ctx);
    const thread = await requireThread(ctx, context, args.threadId);

    // Only workspace members can be mentioned; silently drop anything else.
    const mentionedUserIds: Id<"users">[] = [];
    for (const userId of new Set(args.mentionedUserIds ?? [])) {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_workspaceId_and_userId", (q) =>
          q.eq("workspaceId", context.workspace._id).eq("userId", userId),
        )
        .unique();
      if (membership) mentionedUserIds.push(userId);
    }

    const noteId = await ctx.db.insert("notes", {
      workspaceId: thread.workspaceId,
      threadId: thread._id,
      authorId: context.user._id,
      body,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    for (const mentionedUserId of mentionedUserIds) {
      await ctx.db.insert("mentions", {
        workspaceId: thread.workspaceId,
        threadId: thread._id,
        noteId,
        mentionedUserId,
      });
    }
    return null;
  },
});

export const listTeammates = query({
  args: {},
  handler: async (ctx) => {
    const context = await requireWorkspaceContext(ctx);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", context.workspace._id))
      .collect();
    const users = await Promise.all(memberships.map((m) => ctx.db.get(m.userId)));
    return await Promise.all(
      users
        .flatMap((member) => (member ? [member] : []))
        .map(async (member) => ({
          _id: member._id,
          name: displayName(member),
          imageUrl: await avatarUrl(ctx, member),
        })),
    );
  },
});

async function markThreadRead(
  ctx: MutationCtx,
  thread: Doc<"threads">,
  actorId: Id<"users">,
) {
  const now = Date.now();
  const existing = await ctx.db
    .query("threadReads")
    .withIndex("by_userId_and_threadId", (q) =>
      q.eq("userId", actorId).eq("threadId", thread._id),
    )
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, { lastReadAt: now });
  } else {
    await ctx.db.insert("threadReads", {
      workspaceId: thread.workspaceId,
      threadId: thread._id,
      userId: actorId,
      lastReadAt: now,
    });
  }
}

export const markRead = mutation({
  args: { threadId: v.id("threads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await requireWorkspaceContext(ctx);
    const thread = await requireThread(ctx, context, args.threadId);
    await markThreadRead(ctx, thread, context.user._id);
    return null;
  },
});

export const setStatus = mutation({
  args: {
    threadId: v.id("threads"),
    status: v.union(v.literal("open"), v.literal("waiting"), v.literal("closed")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await requireWorkspaceContext(ctx);
    const thread = await requireThread(ctx, context, args.threadId);
    await ctx.db.patch(thread._id, { status: args.status });
    return null;
  },
});

export const assign = mutation({
  args: {
    threadId: v.id("threads"),
    teammateId: v.union(v.id("users"), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await requireWorkspaceContext(ctx);
    const thread = await requireThread(ctx, context, args.threadId);
    if (args.teammateId !== null) {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_workspaceId_and_userId", (q) =>
          q
            .eq("workspaceId", context.workspace._id)
            .eq("userId", args.teammateId as Id<"users">),
        )
        .unique();
      if (!membership) throw new Error("Teammate is not in this workspace");
    }
    await ctx.db.patch(thread._id, { assigneeId: args.teammateId ?? undefined });
    return null;
  },
});

export const sendReply = mutation({
  args: {
    threadId: v.id("threads"),
    body: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const body = args.body.trim();
    if (body.length === 0) throw new Error("Reply body cannot be empty");
    const context = await requireWorkspaceContext(ctx);
    const thread = await requireThread(ctx, context, args.threadId);
    const sentAt = Date.now();
    await ctx.db.insert("messages", {
      workspaceId: thread.workspaceId,
      threadId: thread._id,
      direction: "outbound",
      authorId: context.user._id,
      body,
      sentAt,
    });
    await ctx.db.patch(thread._id, { status: "waiting", lastMessageAt: sentAt });
    await markThreadRead(ctx, { ...thread, lastMessageAt: sentAt }, context.user._id);
    return null;
  },
});

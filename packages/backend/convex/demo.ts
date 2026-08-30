import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import {
  env,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { isSeedUser, seedDemo, WORKSPACE_SLUG } from "./seed";

function displayName(user: Doc<"users">) {
  return user.name ?? user.username ?? "Teammate";
}

function requireDemoEnabled() {
  if (env.ALLOW_DEMO_TEST_PAGE !== "true") {
    throw new Error(
      "The demo test API is disabled. Set ALLOW_DEMO_TEST_PAGE=true on this deployment to enable it.",
    );
  }
}

async function getDemoWorkspace(ctx: QueryCtx): Promise<Doc<"workspaces"> | null> {
  return await ctx.db
    .query("workspaces")
    .withIndex("by_slug", (q) => q.eq("slug", WORKSPACE_SLUG))
    .unique();
}

async function requireUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new Error("Sign in to use the test inbox");
  }
  const userId = ctx.db.normalizeId("users", identity.subject);
  const user = userId === null ? null : await ctx.db.get("users", userId);
  if (!user) {
    throw new Error("Sign in to use the test inbox");
  }
  return user;
}

async function getMembership(
  ctx: QueryCtx,
  workspace: Doc<"workspaces">,
  user: Doc<"users">,
): Promise<Doc<"memberships"> | null> {
  return await ctx.db
    .query("memberships")
    .withIndex("by_workspaceId_and_userId", (q) =>
      q.eq("workspaceId", workspace._id).eq("userId", user._id),
    )
    .unique();
}

async function requireMember(
  ctx: QueryCtx,
  workspace: Doc<"workspaces">,
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  const membership = await getMembership(ctx, workspace, user);
  if (!membership) {
    throw new Error("You are not a member of the demo workspace");
  }
  return user;
}

async function requireDemoThread(
  ctx: QueryCtx,
  threadId: Id<"threads">,
): Promise<{ workspace: Doc<"workspaces">; thread: Doc<"threads"> }> {
  const workspace = await getDemoWorkspace(ctx);
  if (!workspace) throw new Error("Demo workspace is not seeded");
  const thread = await ctx.db.get(threadId);
  if (!thread || thread.workspaceId !== workspace._id) {
    throw new Error("Thread not found in the demo workspace");
  }
  return { workspace, thread };
}

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
  return {
    _id: thread._id,
    inboxId: thread.inboxId,
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
    labels,
    unread: await isUnread(ctx, actorId, thread),
  };
}

async function joinDemoWorkspace(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  user: Doc<"users">,
) {
  const workspace = await ctx.db.get(workspaceId);
  if (!workspace) throw new Error("Demo workspace is not seeded");
  const membership = await getMembership(ctx, workspace, user);
  if (membership) return;
  await ctx.db.insert("memberships", {
    workspaceId,
    userId: user._id,
    role: "member",
  });
  const workspaceInboxes = await ctx.db
    .query("inboxes")
    .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  for (const inbox of workspaceInboxes) {
    await ctx.db.insert("inboxAccess", {
      workspaceId,
      inboxId: inbox._id,
      userId: user._id,
    });
  }
  // Mirror a seed teammate's read state so the demo unread story matches.
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  for (const member of memberships) {
    const memberUser = await ctx.db.get(member.userId);
    if (!memberUser || !isSeedUser(memberUser)) continue;
    const reads = await ctx.db
      .query("threadReads")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", memberUser._id).eq("workspaceId", workspaceId),
      )
      .collect();
    for (const read of reads) {
      await ctx.db.insert("threadReads", {
        workspaceId: read.workspaceId,
        inboxId: read.inboxId,
        threadId: read.threadId,
        userId: user._id,
        lastReadAt: read.lastReadAt,
      });
    }
    break;
  }
}

export const ensureSeeded = mutation({
  args: {},
  handler: async (ctx) => {
    requireDemoEnabled();
    const user = await requireUser(ctx);
    const result = await seedDemo(ctx, false);
    await joinDemoWorkspace(ctx, result.workspaceId, user);
    return { workspaceId: result.workspaceId, seeded: result.seeded };
  },
});

export const listInboxes = query({
  args: {},
  handler: async (ctx) => {
    requireDemoEnabled();
    const user = await requireUser(ctx);
    const workspace = await getDemoWorkspace(ctx);
    if (!workspace) return null;
    if (!(await getMembership(ctx, workspace, user))) return null;
    const inboxes = await ctx.db
      .query("inboxes")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspace._id))
      .collect();
    return await Promise.all(
      inboxes.map(async (inbox) => {
        const channel = await ctx.db
          .query("channels")
          .withIndex("by_inboxId", (q) => q.eq("inboxId", inbox._id))
          .first();
        const inboxThreads = await ctx.db
          .query("threads")
          .withIndex("by_inboxId_and_status_and_lastMessageAt", (q) =>
            q.eq("inboxId", inbox._id),
          )
          .collect();
        let unreadCount = 0;
        for (const thread of inboxThreads) {
          if (await isUnread(ctx, user._id, thread)) unreadCount += 1;
        }
        return {
          _id: inbox._id,
          name: inbox.name,
          channel: channel
            ? {
                provider: channel.provider,
                emailAddress: channel.emailAddress,
                displayName: channel.displayName,
                status: channel.status,
              }
            : null,
          openCount: inboxThreads.filter((thread) => thread.status === "open")
            .length,
          unreadCount,
        };
      }),
    );
  },
});

export const listThreads = query({
  args: {
    inboxId: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("open"), v.literal("waiting"), v.literal("closed")),
    ),
  },
  handler: async (ctx, args) => {
    requireDemoEnabled();
    const user = await requireUser(ctx);
    const workspace = await getDemoWorkspace(ctx);
    if (!workspace) return null;
    if (!(await getMembership(ctx, workspace, user))) return null;
    let threads: Doc<"threads">[];
    if (args.inboxId !== undefined) {
      const inboxId = ctx.db.normalizeId("inboxes", args.inboxId);
      if (!inboxId) return null;
      const inbox = await ctx.db.get(inboxId);
      if (!inbox || inbox.workspaceId !== workspace._id) return null;
      threads = await ctx.db
        .query("threads")
        .withIndex("by_inboxId_and_status_and_lastMessageAt", (q) =>
          q.eq("inboxId", inbox._id),
        )
        .collect();
      threads.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    } else {
      threads = await ctx.db
        .query("threads")
        .withIndex("by_workspaceId_and_lastMessageAt", (q) =>
          q.eq("workspaceId", workspace._id),
        )
        .order("desc")
        .collect();
    }
    if (args.status) {
      threads = threads.filter((thread) => thread.status === args.status);
    }
    return await Promise.all(
      threads.map((thread) => threadSummary(ctx, user._id, thread)),
    );
  },
});

export const getThread = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    requireDemoEnabled();
    const user = await requireUser(ctx);
    const workspace = await getDemoWorkspace(ctx);
    if (!workspace) return null;
    if (!(await getMembership(ctx, workspace, user))) return null;
    const threadId = ctx.db.normalizeId("threads", args.threadId);
    if (!threadId) return null;
    const thread = await ctx.db.get(threadId);
    if (!thread || thread.workspaceId !== workspace._id) return null;
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_threadId_and_sentAt", (q) => q.eq("threadId", thread._id))
      .order("asc")
      .collect();
    const inbox = await ctx.db.get(thread.inboxId);
    const companyProfile = await ctx.db
      .query("companyProfiles")
      .withIndex("by_workspaceId_and_domain", (q) =>
        q.eq("workspaceId", workspace._id).eq("domain", thread.senderDomain),
      )
      .unique();
    return {
      ...(await threadSummary(ctx, user._id, thread)),
      inboxName: inbox?.name ?? "Unknown",
      companyProfile: companyProfile
        ? {
            name: companyProfile.name,
            description: companyProfile.description ?? null,
            industry: companyProfile.industry ?? null,
            website: companyProfile.website ?? null,
            logoUrl: companyProfile.logoUrl ?? null,
          }
        : null,
      messages: await Promise.all(
        messages.map(async (message) => ({
          _id: message._id,
          direction: message.direction,
          body: message.body,
          sentAt: message.sentAt,
          senderName: message.senderName ?? null,
          author: await (async () => {
            if (!message.authorId) return null;
            const author = await ctx.db.get(message.authorId);
            return author ? displayName(author) : null;
          })(),
        })),
      ),
    };
  },
});

export const listTeammates = query({
  args: {},
  handler: async (ctx) => {
    requireDemoEnabled();
    const user = await requireUser(ctx);
    const workspace = await getDemoWorkspace(ctx);
    if (!workspace) return null;
    if (!(await getMembership(ctx, workspace, user))) return null;
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspace._id))
      .collect();
    const users = await Promise.all(memberships.map((m) => ctx.db.get(m.userId)));
    return users.flatMap((member) =>
      member ? [{ _id: member._id, name: displayName(member) }] : [],
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
      inboxId: thread.inboxId,
      threadId: thread._id,
      userId: actorId,
      lastReadAt: now,
    });
  }
}

export const markRead = mutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    requireDemoEnabled();
    const { workspace, thread } = await requireDemoThread(ctx, args.threadId);
    const user = await requireMember(ctx, workspace);
    await markThreadRead(ctx, thread, user._id);
    return null;
  },
});

export const setStatus = mutation({
  args: {
    threadId: v.id("threads"),
    status: v.union(v.literal("open"), v.literal("waiting"), v.literal("closed")),
  },
  handler: async (ctx, args) => {
    requireDemoEnabled();
    const { workspace, thread } = await requireDemoThread(ctx, args.threadId);
    await requireMember(ctx, workspace);
    await ctx.db.patch(thread._id, { status: args.status });
    return null;
  },
});

export const assign = mutation({
  args: {
    threadId: v.id("threads"),
    teammateId: v.union(v.id("users"), v.null()),
  },
  handler: async (ctx, args) => {
    requireDemoEnabled();
    const { workspace, thread } = await requireDemoThread(ctx, args.threadId);
    await requireMember(ctx, workspace);
    if (args.teammateId !== null) {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_workspaceId_and_userId", (q) =>
          q
            .eq("workspaceId", workspace._id)
            .eq("userId", args.teammateId as Id<"users">),
        )
        .unique();
      if (!membership) throw new Error("Teammate is not in the demo workspace");
    }
    await ctx.db.patch(thread._id, {
      assigneeId: args.teammateId ?? undefined,
    });
    return null;
  },
});

export const sendReply = mutation({
  args: {
    threadId: v.id("threads"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    requireDemoEnabled();
    const body = args.body.trim();
    if (body.length === 0) throw new Error("Reply body cannot be empty");
    const { workspace, thread } = await requireDemoThread(ctx, args.threadId);
    const user = await requireMember(ctx, workspace);
    const sentAt = Date.now();
    await ctx.db.insert("messages", {
      workspaceId: thread.workspaceId,
      threadId: thread._id,
      direction: "outbound",
      authorId: user._id,
      body,
      sentAt,
    });
    await ctx.db.patch(thread._id, { status: "waiting", lastMessageAt: sentAt });
    await markThreadRead(ctx, { ...thread, lastMessageAt: sentAt }, user._id);
    return null;
  },
});

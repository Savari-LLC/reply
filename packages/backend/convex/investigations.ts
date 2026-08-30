import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { requireWorkspaceContext, type WorkspaceContext } from "./authHelpers";
import { canAccessInbox } from "./lib/access";
import {
  emailCategoryValidator,
  investigationErrorValidator,
  investigationStatusValidator,
} from "./schema";

/** Technical emails at or above this confidence auto-start a Devin session. */
export const AUTO_INVESTIGATE_THRESHOLD = 0.85;

async function canAccessThread(
  ctx: QueryCtx,
  context: WorkspaceContext,
  thread: Doc<"threads">,
): Promise<boolean> {
  if (thread.workspaceId !== context.workspace._id) return false;
  const channel = await ctx.db.get(thread.channelId);
  const inbox = channel ? await ctx.db.get(channel.inboxId) : null;
  return inbox !== null && (await canAccessInbox(ctx, context.membership, inbox));
}

/** Latest investigation for a thread; threads have at most one active run. */
export async function latestInvestigation(
  ctx: QueryCtx,
  threadId: Doc<"threads">["_id"],
): Promise<Doc<"investigations"> | null> {
  return await ctx.db
    .query("investigations")
    .withIndex("by_threadId", (q) => q.eq("threadId", threadId))
    .order("desc")
    .first();
}

/**
 * Persist the LLM triage result on the thread. High-confidence technical
 * emails automatically queue a Devin investigation — no manual trigger.
 */
export const recordClassification = internalMutation({
  args: {
    threadId: v.id("threads"),
    emailId: v.id("messages"),
    category: emailCategoryValidator,
    confidence: v.number(),
    shortSummary: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return null;
    const confidence = Math.min(1, Math.max(0, args.confidence));
    await ctx.db.patch(thread._id, {
      classification: {
        category: args.category,
        confidence,
        shortSummary: args.shortSummary,
        classifiedAt: Date.now(),
      },
    });

    if (args.category !== "technical" || confidence < AUTO_INVESTIGATE_THRESHOLD) {
      return null;
    }
    // One investigation per thread; re-runs go through `retry`.
    const existing = await latestInvestigation(ctx, thread._id);
    if (existing) return null;

    const investigationId = await ctx.db.insert("investigations", {
      workspaceId: thread.workspaceId,
      threadId: thread._id,
      emailId: args.emailId,
      category: args.category,
      confidence,
      status: "queued",
    });
    await ctx.scheduler.runAfter(0, internal.devin.startInvestigation, {
      investigationId,
    });
    return null;
  },
});

/** Email content for the LLM classifier; internal-only, args are trusted. */
export const getClassificationContext = internalQuery({
  args: { threadId: v.id("threads"), emailId: v.id("messages") },
  returns: v.union(
    v.object({
      subject: v.string(),
      senderName: v.string(),
      senderEmail: v.string(),
      body: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    const email = await ctx.db.get(args.emailId);
    if (!thread || !email || email.threadId !== thread._id) return null;
    return {
      subject: thread.subject,
      senderName: thread.senderName,
      senderEmail: thread.senderEmail,
      body: email.body,
    };
  },
});

/** Everything the Devin action needs to open a session; internal-only. */
export const getStartContext = internalQuery({
  args: { investigationId: v.id("investigations") },
  returns: v.union(
    v.object({
      status: investigationStatusValidator,
      repoUrl: v.union(v.string(), v.null()),
      workspaceName: v.string(),
      subject: v.string(),
      senderName: v.string(),
      senderEmail: v.string(),
      emailBody: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const investigation = await ctx.db.get(args.investigationId);
    if (!investigation) return null;
    const [thread, email, workspace] = await Promise.all([
      ctx.db.get(investigation.threadId),
      ctx.db.get(investigation.emailId),
      ctx.db.get(investigation.workspaceId),
    ]);
    if (!thread || !email || !workspace) return null;
    return {
      status: investigation.status,
      repoUrl: workspace.devinRepoUrl ?? null,
      workspaceName: workspace.name,
      subject: thread.subject,
      senderName: thread.senderName,
      senderEmail: thread.senderEmail,
      emailBody: email.body,
    };
  },
});

const progressFields = {
  status: v.optional(investigationStatusValidator),
  currentStage: v.optional(v.string()),
  devinSessionId: v.optional(v.string()),
  devinSessionUrl: v.optional(v.string()),
  customerFriendlySummary: v.optional(v.string()),
  impact: v.optional(v.string()),
  rootCause: v.optional(v.string()),
  fixSummary: v.optional(v.string()),
  testsPassed: v.optional(v.boolean()),
  pullRequestUrl: v.optional(v.string()),
  pullRequestNumber: v.optional(v.number()),
  noIssueFound: v.optional(v.boolean()),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
};

/**
 * Liveness check for the polling loop. Pollers stop when the investigation
 * is gone, terminal, or now owned by a newer Devin session (after a retry),
 * so a zombie poller can never clobber fresh state.
 */
export const getPollState = internalQuery({
  args: { investigationId: v.id("investigations") },
  returns: v.union(
    v.object({
      status: investigationStatusValidator,
      devinSessionId: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const investigation = await ctx.db.get(args.investigationId);
    if (!investigation) return null;
    return {
      status: investigation.status,
      devinSessionId: investigation.devinSessionId ?? null,
    };
  },
});

/** Progress writes from the Devin poller; only provided fields are patched. */
export const applyProgress = internalMutation({
  args: { investigationId: v.id("investigations"), ...progressFields },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { investigationId, ...fields } = args;
    const investigation = await ctx.db.get(investigationId);
    if (!investigation) return null;
    // Never regress a terminal investigation (e.g. a late write racing a retry).
    if (
      (investigation.status === "completed" || investigation.status === "failed") &&
      fields.status !== "completed"
    ) {
      return null;
    }
    const patch = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(investigationId, { ...patch, error: undefined });
    }
    return null;
  },
});

export const markFailed = internalMutation({
  args: {
    investigationId: v.id("investigations"),
    error: investigationErrorValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const investigation = await ctx.db.get(args.investigationId);
    // A finished investigation stays finished; never downgrade it to failed.
    if (!investigation || investigation.status === "completed") return null;
    await ctx.db.patch(args.investigationId, {
      status: "failed",
      error: args.error,
      completedAt: Date.now(),
    });
    return null;
  },
});

/**
 * A running investigation this old is considered stuck (dead poll chain or
 * abandoned session) and may be retried by an operator.
 */
export const STALE_RUN_MS = 45 * 60 * 1000;

/**
 * Retry a failed (or stuck) investigation for a thread the caller can access.
 * Clears prior findings and re-queues the Devin start action.
 */
export const retry = mutation({
  args: { investigationId: v.id("investigations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await requireWorkspaceContext(ctx);
    const investigation = await ctx.db.get(args.investigationId);
    if (!investigation || investigation.workspaceId !== context.workspace._id) {
      throw new Error("Investigation not found");
    }
    const thread = await ctx.db.get(investigation.threadId);
    if (!thread || !(await canAccessThread(ctx, context, thread))) {
      throw new Error("Investigation not found");
    }
    const terminal =
      investigation.status === "failed" || investigation.status === "completed";
    const startedAt = investigation.startedAt ?? investigation._creationTime;
    const stuck = !terminal && Date.now() - startedAt > STALE_RUN_MS;
    if (!terminal && !stuck) {
      throw new Error("This investigation is still running");
    }
    await ctx.db.patch(investigation._id, {
      status: "queued",
      currentStage: undefined,
      devinSessionId: undefined,
      devinSessionUrl: undefined,
      customerFriendlySummary: undefined,
      impact: undefined,
      rootCause: undefined,
      fixSummary: undefined,
      testsPassed: undefined,
      pullRequestUrl: undefined,
      pullRequestNumber: undefined,
      noIssueFound: undefined,
      startedAt: undefined,
      completedAt: undefined,
      error: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.devin.startInvestigation, {
      investigationId: investigation._id,
    });
    return null;
  },
});

/** Basic git-over-HTTPS repository URL, e.g. https://github.com/owner/repo. */
const REPO_URL_PATTERN = /^https:\/\/[\w.-]+\/[\w.-]+\/[\w.-]+\/?$/;

/**
 * Connect the repository Devin investigates for this workspace. Any member
 * can connect it during the demo; the URL is validated, never executed.
 */
export const setRepository = mutation({
  args: { repoUrl: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await requireWorkspaceContext(ctx);
    const repoUrl = args.repoUrl.trim().replace(/\.git$/, "");
    if (!REPO_URL_PATTERN.test(repoUrl)) {
      throw new Error("Enter a repository URL like https://github.com/owner/repo");
    }
    await ctx.db.patch(context.workspace._id, { devinRepoUrl: repoUrl });

    // Un-block investigations that failed only because no repo was connected.
    const stuck = await ctx.db
      .query("investigations")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", context.workspace._id))
      .collect();
    for (const investigation of stuck) {
      if (investigation.status === "failed" && investigation.error?.code === "no_repository") {
        await ctx.db.patch(investigation._id, {
          status: "queued",
          error: undefined,
          completedAt: undefined,
        });
        await ctx.scheduler.runAfter(0, internal.devin.startInvestigation, {
          investigationId: investigation._id,
        });
      }
    }
    return null;
  },
});

/** Whether a repository is connected for the caller's workspace. */
export const repository = query({
  args: {},
  returns: v.object({ repoUrl: v.union(v.string(), v.null()) }),
  handler: async (ctx) => {
    const context = await requireWorkspaceContext(ctx);
    return { repoUrl: context.workspace.devinRepoUrl ?? null };
  },
});

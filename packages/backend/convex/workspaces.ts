import { v } from "convex/values";

import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getCurrentUser, requireCurrentUser } from "./authHelpers";
import schema from "./schema";

const currentWorkspaceValidator = v.object({
  workspace: schema.doc("workspaces"),
  membership: schema.doc("memberships"),
  memberCount: v.number(),
});

function normalizeWorkspaceName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2) {
    throw new Error("Workspace name must be at least 2 characters");
  }
  if (name.length > 80) {
    throw new Error("Workspace name must be at most 80 characters");
  }
  return name;
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "workspace"
  );
}

async function availableSlug(ctx: MutationCtx, name: string, userId: string) {
  const base = slugify(name);
  const suffix = userId.slice(-6).toLowerCase();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${suffix}${attempt === 1 ? "" : `-${attempt}`}`;
    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing === null) {
      return slug;
    }
  }
  throw new Error("Could not create a unique workspace URL");
}

export const getCurrent = query({
  args: {},
  returns: v.union(currentWorkspaceValidator, v.null()),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) {
      return null;
    }
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    if (membership === null) {
      return null;
    }
    const workspace = await ctx.db.get(membership.workspaceId);
    if (workspace === null) {
      return null;
    }
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspace._id))
      .take(101);
    return { workspace, membership, memberCount: memberships.length };
  },
});

export const create = mutation({
  args: { name: v.string() },
  returns: v.id("workspaces"),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const existingMembership = await ctx.db
      .query("memberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    if (existingMembership !== null) {
      return existingMembership.workspaceId;
    }

    const name = normalizeWorkspaceName(args.name);
    const slug = await availableSlug(ctx, name, user._id);
    const workspaceId = await ctx.db.insert("workspaces", {
      name,
      slug,
      createdBy: user._id,
    });
    await ctx.db.insert("memberships", {
      workspaceId,
      userId: user._id,
      role: "admin",
    });
    for (const inboxName of ["Sales", "Accounts", "Support"]) {
      await ctx.db.insert("inboxes", { workspaceId, name: inboxName });
    }
    return workspaceId;
  },
});

export const completeOnboarding = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    if (membership === null || membership.role !== "admin") {
      throw new Error("Only a workspace admin can complete onboarding");
    }
    await ctx.db.patch(membership.workspaceId, { onboardingCompletedAt: Date.now() });
    return null;
  },
});

import { v } from "convex/values";

import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getActiveMembership, getCurrentUser, requireCurrentUser } from "./authHelpers";
import { ensurePersonalInbox } from "./lib/access";
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
    const membership = await getActiveMembership(ctx, user._id);
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
    const name = normalizeWorkspaceName(args.name);
    // Onboarding retries (double submit, network replays) must not fan out
    // into duplicate workspaces: re-activate an existing one with this name.
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(100);
    if (memberships.length >= 20) {
      throw new Error("You have reached the limit of 20 workspaces");
    }
    for (const membership of memberships) {
      const existing = await ctx.db.get(membership.workspaceId);
      if (existing !== null && existing.name === name && existing.createdBy === user._id) {
        await ctx.db.patch(membership._id, { activeAt: Date.now() });
        return existing._id;
      }
    }

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
      activeAt: Date.now(),
    });
    for (const inboxName of ["Sales", "Accounts", "Support"]) {
      await ctx.db.insert("inboxes", { workspaceId, name: inboxName, kind: "shared" });
    }
    await ensurePersonalInbox(ctx, workspaceId, user._id);
    return workspaceId;
  },
});

export const completeOnboarding = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const membership = await getActiveMembership(ctx, user._id);
    if (membership === null || membership.role !== "admin") {
      throw new Error("Only a workspace admin can complete onboarding");
    }
    await ctx.db.patch(membership.workspaceId, { onboardingCompletedAt: Date.now() });
    return null;
  },
});

const workspaceListItemValidator = v.object({
  _id: v.id("workspaces"),
  name: v.string(),
  role: v.union(v.literal("admin"), v.literal("member")),
  isActive: v.boolean(),
});

/** Every workspace the caller belongs to, active one flagged, A→Z. */
export const listMine = query({
  args: {},
  returns: v.array(workspaceListItemValidator),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) {
      return [];
    }
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(100);
    const active = await getActiveMembership(ctx, user._id);
    const items = [];
    for (const membership of memberships) {
      const workspace = await ctx.db.get(membership.workspaceId);
      if (workspace === null) continue;
      items.push({
        _id: workspace._id,
        name: workspace.name,
        role: membership.role,
        isActive: membership._id === active?._id,
      });
    }
    return items.sort((a, b) => a.name.localeCompare(b.name));
  },
});

/** Makes one of the caller's own memberships the active workspace. */
export const switchTo = mutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_workspaceId_and_userId", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", user._id),
      )
      .unique();
    if (membership === null) {
      throw new Error("You are not a member of that workspace");
    }
    await ctx.db.patch(membership._id, { activeAt: Date.now() });
    return null;
  },
});

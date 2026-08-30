import type { UserIdentity } from "convex/server";

import type { Doc } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";

type AuthCtx = Pick<ActionCtx | MutationCtx | QueryCtx, "auth">;
type DatabaseAuthCtx = Pick<MutationCtx | QueryCtx, "auth" | "db">;

export async function getIdentity(ctx: AuthCtx): Promise<UserIdentity | null> {
  return await ctx.auth.getUserIdentity();
}

export async function requireIdentity(ctx: AuthCtx): Promise<UserIdentity> {
  const identity = await getIdentity(ctx);
  if (identity === null) {
    throw new Error("Sign in to continue");
  }
  return identity;
}

export async function getCurrentUser(ctx: DatabaseAuthCtx): Promise<Doc<"users"> | null> {
  const identity = await getIdentity(ctx);
  if (identity === null) {
    return null;
  }
  const userId = ctx.db.normalizeId("users", identity.subject);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
}

export async function requireCurrentUser(ctx: DatabaseAuthCtx): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (user === null) {
    throw new Error("Your account could not be found");
  }
  return user;
}

export type WorkspaceContext = {
  user: Doc<"users">;
  membership: Doc<"memberships">;
  workspace: Doc<"workspaces">;
};

/** Resolves the caller's workspace from their identity; never from arguments. */
export async function requireWorkspaceContext(ctx: DatabaseAuthCtx): Promise<WorkspaceContext> {
  const user = await requireCurrentUser(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .unique();
  if (membership === null) {
    throw new Error("Join a workspace to continue");
  }
  const workspace = await ctx.db.get(membership.workspaceId);
  if (workspace === null) {
    throw new Error("Workspace not found");
  }
  return { user, membership, workspace };
}

export async function requireWorkspaceAdmin(ctx: DatabaseAuthCtx): Promise<WorkspaceContext> {
  const context = await requireWorkspaceContext(ctx);
  if (context.membership.role !== "admin") {
    throw new Error("Only a workspace admin can do this");
  }
  return context;
}

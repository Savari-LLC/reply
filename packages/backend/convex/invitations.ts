import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { Resend } from "@convex-dev/resend";
import { v } from "convex/values";

import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, env, internalMutation, internalQuery, query } from "./_generated/server";
import { getActiveMembership, requireCurrentUser, requireIdentity } from "./authHelpers";
import { ensurePersonalInbox, grantAllSharedInboxes } from "./lib/access";

const invitationRateLimiter = new RateLimiter(components.rateLimiter, {
  sendInvitations: { kind: "fixed window", rate: 50, period: HOUR },
});

const resend = new Resend(components.resend, {
  apiKey: env.RESEND_API_KEY,
  testMode: false,
});

const invitationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("revoked"),
);

const invitationListItemValidator = v.object({
  _id: v.id("workspaceInvitations"),
  email: v.string(),
  expiresAt: v.number(),
  status: invitationStatusValidator,
});

const acceptResultValidator = v.object({
  workspaceId: v.id("workspaces"),
  workspaceName: v.string(),
  alreadyMember: v.boolean(),
});

const inviteLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmails(values: string[]) {
  const emails = [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
  if (emails.length === 0) {
    throw new Error("Add at least one email address");
  }
  if (emails.length > 20) {
    throw new Error("Invite up to 20 people at a time");
  }
  for (const email of emails) {
    if (email.length > 254 || !emailPattern.test(email)) {
      throw new Error(`Enter a valid email address: ${email}`);
    }
  }
  return emails;
}

function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function configuredAppUrl() {
  const value = env.APP_URL.trim();
  if (!value) {
    throw new Error("Workspace invitations are not configured yet: APP_URL is missing");
  }
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("APP_URL must use http or https");
  }
  return url.origin;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function invitationEmail(workspaceName: string, inviterName: string, inviteUrl: string) {
  const safeWorkspace = escapeHtml(workspaceName);
  const safeInviter = escapeHtml(inviterName);
  const safeUrl = escapeHtml(inviteUrl);
  return {
    subject: `${inviterName} invited you to ${workspaceName} on Reply`,
    html: `<div style="margin:0 auto;max-width:560px;padding:40px 24px;font-family:Arial,sans-serif;color:#202d2a"><div style="display:inline-block;border-radius:12px;background:#ff7a66;padding:10px 12px;color:white;font-weight:700">reply</div><h1 style="margin:28px 0 12px;font-size:28px;line-height:1.2">Join ${safeWorkspace}</h1><p style="margin:0 0 24px;color:#60706b;line-height:1.7">${safeInviter} invited you to collaborate in their Reply workspace. Create an account or sign in to accept the invitation.</p><a href="${safeUrl}" style="display:inline-block;border-radius:12px;background:#202d2a;padding:13px 20px;color:white;text-decoration:none;font-weight:700">Accept invitation</a><p style="margin:24px 0 0;color:#8a9692;font-size:12px;line-height:1.6">This invitation expires in 7 days. If you were not expecting it, you can ignore this email.</p></div>`,
    text: `${inviterName} invited you to join ${workspaceName} on Reply. Accept the invitation within 7 days: ${inviteUrl}`,
  };
}

export const getInviteContext = internalQuery({
  args: { actorSubject: v.string() },
  returns: v.object({ workspaceId: v.id("workspaces") }),
  handler: async (ctx, args) => {
    const userId = ctx.db.normalizeId("users", args.actorSubject);
    if (userId === null) {
      throw new Error("Your account could not be found");
    }
    const membership = await getActiveMembership(ctx, userId);
    if (membership === null || membership.role !== "admin") {
      throw new Error("Only a workspace admin can invite members");
    }
    return { workspaceId: membership.workspaceId };
  },
});

export const prepare = internalMutation({
  args: {
    actorSubject: v.string(),
    workspaceId: v.id("workspaces"),
    email: v.string(),
    tokenHash: v.string(),
    expiresAt: v.number(),
  },
  returns: v.object({
    invitationId: v.id("workspaceInvitations"),
    workspaceName: v.string(),
    inviterName: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = ctx.db.normalizeId("users", args.actorSubject);
    if (userId === null) {
      throw new Error("Your account could not be found");
    }
    const user = await ctx.db.get(userId);
    if (user === null) {
      throw new Error("Your account could not be found");
    }
    if (user.authProvider === "google" && user.email?.toLowerCase() === args.email) {
      throw new Error("You are already a member of this workspace");
    }
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_workspaceId_and_userId", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", user._id),
      )
      .unique();
    if (membership === null || membership.role !== "admin") {
      throw new Error("Only a workspace admin can invite members");
    }
    const workspace = await ctx.db.get(args.workspaceId);
    if (workspace === null) {
      throw new Error("Workspace not found");
    }
    const previous = await ctx.db
      .query("workspaceInvitations")
      .withIndex("by_workspaceId_and_email", (q) =>
        q.eq("workspaceId", workspace._id).eq("email", args.email),
      )
      .order("desc")
      .first();
    if (previous?.acceptedAt !== undefined) {
      throw new Error(`${args.email} has already joined this workspace`);
    }
    if (previous !== null) {
      await ctx.db.patch(previous._id, { revokedAt: Date.now() });
    }
    const invitationId = await ctx.db.insert("workspaceInvitations", {
      workspaceId: workspace._id,
      email: args.email,
      invitedBy: user._id,
      tokenHash: args.tokenHash,
      expiresAt: args.expiresAt,
    });
    return {
      invitationId,
      workspaceName: workspace.name,
      inviterName: user.name ?? user.username ?? "A teammate",
    };
  },
});

export const markEmailQueued = internalMutation({
  args: {
    invitationId: v.id("workspaceInvitations"),
    emailId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId);
    if (invitation !== null) {
      await ctx.db.patch(invitation._id, { emailId: args.emailId });
    }
    return null;
  },
});

export const revokeUnsent = internalMutation({
  args: { invitationId: v.id("workspaceInvitations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId);
    if (invitation !== null && invitation.acceptedAt === undefined) {
      await ctx.db.patch(invitation._id, { revokedAt: Date.now() });
    }
    return null;
  },
});

export const send = action({
  args: { emails: v.array(v.string()) },
  returns: v.object({ sent: v.number(), failed: v.array(v.string()) }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const emails = normalizeEmails(args.emails);
    const inviteContext: { workspaceId: Id<"workspaces"> } = await ctx.runQuery(
      internal.invitations.getInviteContext,
      { actorSubject: identity.subject },
    );
    const rateLimit = await invitationRateLimiter.limit(ctx, "sendInvitations", {
      key: inviteContext.workspaceId,
      count: emails.length,
    });
    if (!rateLimit.ok) {
      throw new Error(`Too many invitations. Try again in ${Math.ceil(rateLimit.retryAfter / 60_000)} minutes.`);
    }
    const appUrl = configuredAppUrl();
    const from = env.RESEND_FROM_EMAIL.trim();
    if (!env.RESEND_API_KEY.trim() || !from) {
      throw new Error("Workspace invitations are not configured yet: Resend settings are missing");
    }

    let sent = 0;
    const failed: string[] = [];
    for (const email of emails) {
      let invitationId: Id<"workspaceInvitations"> | null = null;
      try {
        const token = generateToken();
        const tokenHash = await hashToken(token);
        const prepared: {
          invitationId: Id<"workspaceInvitations">;
          workspaceName: string;
          inviterName: string;
        } = await ctx.runMutation(internal.invitations.prepare, {
          actorSubject: identity.subject,
          workspaceId: inviteContext.workspaceId,
          email,
          tokenHash,
          expiresAt: Date.now() + inviteLifetimeMs,
        });
        invitationId = prepared.invitationId;
        const inviteUrl = `${appUrl}/?invite=${encodeURIComponent(token)}`;
        const content = invitationEmail(prepared.workspaceName, prepared.inviterName, inviteUrl);
        const emailId = await resend.sendEmail(ctx, {
          from,
          to: email,
          subject: content.subject,
          html: content.html,
          text: content.text,
        });
        await ctx.runMutation(internal.invitations.markEmailQueued, {
          invitationId: prepared.invitationId,
          emailId: String(emailId),
        });
        sent += 1;
      } catch {
        if (invitationId !== null) {
          await ctx.runMutation(internal.invitations.revokeUnsent, { invitationId });
        }
        failed.push(email);
      }
    }
    return { sent, failed };
  },
});

export const listCurrent = query({
  args: {},
  returns: v.array(invitationListItemValidator),
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const membership = await getActiveMembership(ctx, user._id);
    if (membership === null || membership.role !== "admin") {
      return [];
    }
    const invitations = await ctx.db
      .query("workspaceInvitations")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", membership.workspaceId))
      .order("desc")
      .take(100);
    const latestByEmail = new Map<string, (typeof invitations)[number]>();
    for (const invitation of invitations) {
      if (!latestByEmail.has(invitation.email)) {
        latestByEmail.set(invitation.email, invitation);
      }
    }
    return [...latestByEmail.values()].map((invitation) => ({
      _id: invitation._id,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      status:
        invitation.acceptedAt !== undefined
          ? ("accepted" as const)
          : invitation.revokedAt !== undefined
            ? ("revoked" as const)
            : ("pending" as const),
    }));
  },
});

export const acceptPrepared = internalMutation({
  args: {
    actorSubject: v.string(),
    tokenHash: v.string(),
  },
  returns: acceptResultValidator,
  handler: async (ctx, args) => {
    const userId = ctx.db.normalizeId("users", args.actorSubject);
    if (userId === null) {
      throw new Error("Your account could not be found");
    }
    const user = await ctx.db.get(userId);
    if (user === null) {
      throw new Error("Your account could not be found");
    }
    const invitation = await ctx.db
      .query("workspaceInvitations")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (invitation === null || invitation.revokedAt !== undefined) {
      throw new Error("This invitation is invalid or has been replaced");
    }
    if (invitation.expiresAt <= Date.now()) {
      throw new Error("This invitation has expired");
    }
    if (invitation.acceptedAt !== undefined) {
      if (invitation.acceptedBy !== user._id) {
        throw new Error("This invitation has already been used");
      }
    }
    const accountEmail = user.email?.toLowerCase();
    if (user.authProvider === "google" && accountEmail !== invitation.email) {
      throw new Error("Sign in with the Google account that received this invitation");
    }
    if (user.authProvider === "password" && accountEmail && accountEmail !== invitation.email) {
      throw new Error("This invitation was sent to a different email address");
    }
    const workspace = await ctx.db.get(invitation.workspaceId);
    if (workspace === null) {
      throw new Error("Workspace not found");
    }
    const existingMembership = await ctx.db
      .query("memberships")
      .withIndex("by_workspaceId_and_userId", (q) =>
        q.eq("workspaceId", workspace._id).eq("userId", user._id),
      )
      .unique();
    if (existingMembership === null) {
      await ctx.db.insert("memberships", {
        workspaceId: workspace._id,
        userId: user._id,
        role: "member",
        activeAt: Date.now(),
      });
      await ensurePersonalInbox(ctx, workspace._id, user._id);
      await grantAllSharedInboxes(ctx, workspace._id, user._id);
    } else {
      // Accepting an invite to a workspace you already belong to switches you into it.
      await ctx.db.patch(existingMembership._id, { activeAt: Date.now() });
    }
    if (user.authProvider === "password" && user.email === undefined) {
      await ctx.db.patch(user._id, { email: invitation.email });
    }
    if (invitation.acceptedAt === undefined) {
      await ctx.db.patch(invitation._id, {
        acceptedAt: Date.now(),
        acceptedBy: user._id,
      });
    }
    return {
      workspaceId: workspace._id,
      workspaceName: workspace.name,
      alreadyMember: existingMembership !== null,
    };
  },
});

export const accept = action({
  args: { token: v.string() },
  returns: acceptResultValidator,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    if (args.token.length < 32 || args.token.length > 256) {
      throw new Error("This invitation link is invalid");
    }
    const tokenHash = await hashToken(args.token);
    const result: {
      workspaceId: Id<"workspaces">;
      workspaceName: string;
      alreadyMember: boolean;
    } = await ctx.runMutation(internal.invitations.acceptPrepared, {
      actorSubject: identity.subject,
      tokenHash,
    });
    return result;
  },
});

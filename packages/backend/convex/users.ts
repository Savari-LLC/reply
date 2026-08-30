import { vGoogleProfile } from "@convex-dev/auth/providers/oauth/google";
import { v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import { requireCurrentUser } from "./authHelpers";
import { avatarUrl, displayName } from "./lib/avatar";
import schema from "./schema";

const MAX_NAME_LENGTH = 60;

export const createUserPassword = internalMutation({
  args: {
    provider: v.literal("password"),
    providerAccountId: v.string(),
    profile: v.object({ username: v.string() }),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", {
      authProvider: args.provider,
      providerAccountId: args.providerAccountId,
      username: args.profile.username,
      name: args.profile.username,
    });
  },
});

export const createUserGoogle = internalMutation({
  args: {
    provider: v.literal("google"),
    providerAccountId: v.string(),
    profile: vGoogleProfile,
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", {
      authProvider: args.provider,
      providerAccountId: args.providerAccountId,
      username: args.profile.email ?? args.providerAccountId,
      name: args.profile.name ?? args.profile.email ?? "Google user",
      email: args.profile.email,
      image: args.profile.picture,
    });
  },
});

export const getCurrent = query({
  args: {},
  returns: v.union(schema.doc("users"), v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }
    const userId = ctx.db.normalizeId("users", identity.subject);
    if (userId === null) {
      return null;
    }
    return await ctx.db.get("users", userId);
  },
});

/** Everything the account menu and profile editor need, avatar already resolved. */
export const getProfile = query({
  args: {},
  returns: v.union(
    v.object({
      name: v.string(),
      email: v.union(v.string(), v.null()),
      imageUrl: v.union(v.string(), v.null()),
      hasUploadedImage: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) return null;
    const userId = ctx.db.normalizeId("users", identity.subject);
    if (userId === null) return null;
    const user = await ctx.db.get("users", userId);
    if (user === null) return null;
    return {
      name: displayName(user),
      email: user.email ?? null,
      imageUrl: await avatarUrl(ctx, user),
      hasUploadedImage: user.imageStorageId !== undefined,
    };
  },
});

/** Short-lived URL the browser POSTs the chosen avatar file to. */
export const generateAvatarUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireCurrentUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const updateProfile = mutation({
  args: {
    name: v.string(),
    // Omit to keep the current avatar, pass null to clear it.
    imageStorageId: v.optional(v.union(v.id("_storage"), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const name = args.name.trim();
    if (name.length === 0) throw new Error("Enter your name");
    if (name.length > MAX_NAME_LENGTH) {
      throw new Error(`Names can be at most ${MAX_NAME_LENGTH} characters`);
    }

    await ctx.db.patch(user._id, { name });

    if (args.imageStorageId !== undefined) {
      const next = args.imageStorageId ?? undefined;
      if (user.imageStorageId && user.imageStorageId !== next) {
        await ctx.storage.delete(user.imageStorageId);
      }
      await ctx.db.patch(user._id, { imageStorageId: next });
    }
    return null;
  },
});

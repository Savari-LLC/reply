import { vGoogleProfile } from "@convex-dev/auth/providers/oauth/google";
import { v } from "convex/values";

import { internalMutation, query } from "./_generated/server";
import schema from "./schema";

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
      username: args.profile.username,
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
      email: args.profile.email,
      name: args.profile.name,
      picture: args.profile.picture,
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

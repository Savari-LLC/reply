import { Presence } from "@convex-dev/presence";
import { v } from "convex/values";

import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { requireCurrentUser } from "./authHelpers";
import { avatarUrl } from "./lib/avatar";

export const presence = new Presence(components.presence);

export const heartbeat = mutation({
  args: {
    roomId: v.string(),
    // Sent by the usePresence hook but ignored: identity is derived server-side.
    userId: v.string(),
    sessionId: v.string(),
    interval: v.number(),
  },
  returns: v.object({ roomToken: v.string(), sessionToken: v.string() }),
  handler: async (ctx, { roomId, sessionId, interval }) => {
    const user = await requireCurrentUser(ctx);
    return await presence.heartbeat(ctx, roomId, user._id, sessionId, interval);
  },
});

export const list = query({
  args: { roomToken: v.string() },
  returns: v.array(
    v.object({
      userId: v.string(),
      online: v.boolean(),
      lastDisconnected: v.number(),
      name: v.optional(v.string()),
      image: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, { roomToken }) => {
    const state = await presence.list(ctx, roomToken);
    return await Promise.all(
      state.map(async ({ userId, online, lastDisconnected }) => {
        const id = ctx.db.normalizeId("users", userId);
        const user = id === null ? null : await ctx.db.get("users", id);
        return {
          userId,
          online,
          lastDisconnected,
          name: user?.name ?? user?.username ?? undefined,
          // Uploaded avatar wins over the auth provider's image.
          image: user ? ((await avatarUrl(ctx, user)) ?? undefined) : undefined,
        };
      }),
    );
  },
});

export const disconnect = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, { sessionToken }) => {
    // No auth check: called via sendBeacon on tab close; the opaque session
    // token itself proves ownership of the session.
    await presence.disconnect(ctx, sessionToken);
    return null;
  },
});

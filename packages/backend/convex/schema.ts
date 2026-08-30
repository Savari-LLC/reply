import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Authentication owns account credentials while the application owns these
// minimal user profiles and can extend them with product data later.
export default defineSchema({
  users: defineTable(
    v.union(
      v.object({
        authProvider: v.literal("password"),
        username: v.string(),
      }),
      v.object({
        authProvider: v.literal("google"),
        email: v.optional(v.string()),
        name: v.optional(v.string()),
        picture: v.optional(v.string()),
      }),
    ),
  ),
});

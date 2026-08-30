import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // App-owned people created by Auth v2 callbacks. The auth core maps each
  // provider account to the resulting app user ID used by authenticated calls.
  users: defineTable(
    v.union(
      v.object({
        authProvider: v.literal("password"),
        providerAccountId: v.optional(v.string()),
        username: v.string(),
        name: v.optional(v.string()),
        email: v.optional(v.string()),
        // Avatar uploaded by the member; takes precedence over provider images.
        imageStorageId: v.optional(v.id("_storage")),
      }),
      v.object({
        authProvider: v.literal("google"),
        providerAccountId: v.optional(v.string()),
        username: v.optional(v.string()),
        name: v.optional(v.string()),
        email: v.optional(v.string()),
        image: v.optional(v.string()),
        picture: v.optional(v.string()),
        imageStorageId: v.optional(v.id("_storage")),
      }),
    ),
  )
    .index("by_authProvider_and_providerAccountId", ["authProvider", "providerAccountId"])
    .index("by_username", ["username"]),

  workspaces: defineTable({
    name: v.string(),
    slug: v.string(),
    createdBy: v.optional(v.id("users")),
    onboardingCompletedAt: v.optional(v.number()),
    // Set only by the demo seed; required before the seed may wipe a workspace.
    demoSeed: v.optional(v.boolean()),
  }).index("by_slug", ["slug"]),

  memberships: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
  })
    .index("by_workspaceId_and_userId", ["workspaceId", "userId"])
    .index("by_workspaceId", ["workspaceId"])
    .index("by_userId", ["userId"]),

  workspaceInvitations: defineTable({
    workspaceId: v.id("workspaces"),
    email: v.string(),
    invitedBy: v.id("users"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
    acceptedAt: v.optional(v.number()),
    acceptedBy: v.optional(v.id("users")),
    emailId: v.optional(v.string()),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_email", ["workspaceId", "email"]),

  // Grants a member access to an inbox. Workspace admins bypass this table.
  inboxAccess: defineTable({
    workspaceId: v.id("workspaces"),
    inboxId: v.id("inboxes"),
    userId: v.id("users"),
  })
    .index("by_inboxId_and_userId", ["inboxId", "userId"])
    .index("by_workspaceId_and_userId", ["workspaceId", "userId"])
    .index("by_workspaceId_and_inboxId", ["workspaceId", "inboxId"])
    .index("by_userId", ["userId"]),

  // Shared inboxes belong to the whole workspace; personal inboxes are owned
  // by one member (`ownerId`) and are only visible to that owner. Rows
  // predating the `kind` field are shared.
  inboxes: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    kind: v.optional(v.union(v.literal("shared"), v.literal("personal"))),
    ownerId: v.optional(v.id("users")),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_name", ["workspaceId", "name"])
    .index("by_workspaceId_and_ownerId", ["workspaceId", "ownerId"]),

  // Simulated email connectors. Channels are workspace-level: shared channels
  // belong to the team, personal channels to one member. Conversations live in
  // the channel and surface in every inbox linked through `inboxChannels`.
  // The "demo" provider seeds sample conversations on creation.
  channels: defineTable({
    workspaceId: v.id("workspaces"),
    // Legacy field from when a channel delivered into exactly one inbox.
    inboxId: v.optional(v.id("inboxes")),
    provider: v.union(v.literal("gmail"), v.literal("outlook"), v.literal("demo")),
    emailAddress: v.string(),
    displayName: v.string(),
    status: v.union(v.literal("connected"), v.literal("disconnected")),
    kind: v.optional(v.union(v.literal("shared"), v.literal("personal"))),
    ownerId: v.optional(v.id("users")),
  })
    .index("by_inboxId", ["inboxId"])
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_emailAddress", ["workspaceId", "emailAddress"]),

  // Many-to-many: an inbox aggregates several channels, and one channel can
  // surface in several inboxes (e.g. shared Sales and your personal inbox).
  inboxChannels: defineTable({
    workspaceId: v.id("workspaces"),
    inboxId: v.id("inboxes"),
    channelId: v.id("channels"),
  })
    .index("by_inboxId_and_channelId", ["inboxId", "channelId"])
    .index("by_channelId", ["channelId"])
    .index("by_workspaceId", ["workspaceId"]),

  // Grants a member the right to see/link a shared channel. Admins bypass;
  // personal channels are usable only by their owner.
  channelAccess: defineTable({
    workspaceId: v.id("workspaces"),
    channelId: v.id("channels"),
    userId: v.id("users"),
  })
    .index("by_channelId_and_userId", ["channelId", "userId"])
    .index("by_workspaceId_and_channelId", ["workspaceId", "channelId"])
    .index("by_workspaceId_and_userId", ["workspaceId", "userId"]),

  // The unit of work. Status is open | waiting | closed; the "Assigned" view
  // is derived (status "open" with assigneeId set), never stored.
  threads: defineTable({
    workspaceId: v.id("workspaces"),
    // Legacy: threads now belong to a channel; inbox membership is derived
    // through `inboxChannels`.
    inboxId: v.optional(v.id("inboxes")),
    channelId: v.id("channels"),
    subject: v.string(),
    status: v.union(
      v.literal("open"),
      v.literal("waiting"),
      v.literal("closed"),
    ),
    assigneeId: v.optional(v.id("users")),
    priority: v.union(v.literal("normal"), v.literal("urgent")),
    senderName: v.string(),
    senderEmail: v.string(),
    // Join key to companyProfiles.domain for Context.dev enrichment.
    senderDomain: v.string(),
    lastMessageAt: v.number(),
  })
    .index("by_inboxId_and_status_and_lastMessageAt", [
      "inboxId",
      "status",
      "lastMessageAt",
    ])
    .index("by_inboxId_and_status_and_assigneeId_and_lastMessageAt", [
      "inboxId",
      "status",
      "assigneeId",
      "lastMessageAt",
    ])
    .index("by_workspaceId_and_lastMessageAt", ["workspaceId", "lastMessageAt"])
    .index("by_workspaceId_and_assigneeId_and_status_and_lastMessageAt", [
      "workspaceId",
      "assigneeId",
      "status",
      "lastMessageAt",
    ])
    .index("by_channelId_and_lastMessageAt", ["channelId", "lastMessageAt"]),

  messages: defineTable({
    // Denormalized from the thread so message authz never skips the tenant check.
    workspaceId: v.id("workspaces"),
    threadId: v.id("threads"),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    // Set on outbound replies authored in Reply.
    authorId: v.optional(v.id("users")),
    // Set on inbound messages from the customer.
    senderName: v.optional(v.string()),
    senderEmail: v.optional(v.string()),
    body: v.string(),
    sentAt: v.number(),
  }).index("by_threadId_and_sentAt", ["threadId", "sentAt"]),

  // Per-user unread state, scoped for workspace unread counts.
  threadReads: defineTable({
    workspaceId: v.id("workspaces"),
    // Legacy: unread state is per thread; inboxes are derived from channels.
    inboxId: v.optional(v.id("inboxes")),
    threadId: v.id("threads"),
    userId: v.id("users"),
    lastReadAt: v.number(),
  })
    .index("by_userId_and_threadId", ["userId", "threadId"])
    .index("by_userId_and_workspaceId", ["userId", "workspaceId"])
    .index("by_threadId", ["threadId"]),

  // Internal conversation on a thread; never sent to the customer.
  notes: defineTable({
    workspaceId: v.id("workspaces"),
    threadId: v.id("threads"),
    authorId: v.id("users"),
    body: v.string(),
  }).index("by_threadId", ["threadId"]),

  mentions: defineTable({
    workspaceId: v.id("workspaces"),
    threadId: v.id("threads"),
    noteId: v.id("notes"),
    mentionedUserId: v.id("users"),
  })
    .index("by_mentionedUserId", ["mentionedUserId"])
    .index("by_noteId", ["noteId"]),

  labels: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    color: v.string(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_name", ["workspaceId", "name"]),

  threadLabels: defineTable({
    threadId: v.id("threads"),
    labelId: v.id("labels"),
  })
    .index("by_threadId_and_labelId", ["threadId", "labelId"])
    .index("by_labelId", ["labelId"]),

  // Per-workspace persisted Context.dev summary, reduced to used fields.
  companyProfiles: defineTable({
    workspaceId: v.id("workspaces"),
    domain: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    industry: v.optional(v.string()),
    website: v.optional(v.string()),
    fetchedAt: v.number(),
  }).index("by_workspaceId_and_domain", ["workspaceId", "domain"]),
});

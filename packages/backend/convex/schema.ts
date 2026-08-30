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
    // When this membership was last made the user's active workspace; the
    // highest value wins. Rows predating multi-workspace have none.
    activeAt: v.optional(v.number()),
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

  // The only container members work in. Shared inboxes belong to the whole
  // workspace; personal inboxes are owned by one member (`ownerId`) and are
  // visible only to that owner. Rows predating the `kind` field are shared.
  inboxes: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    kind: v.optional(v.union(v.literal("shared"), v.literal("personal"))),
    ownerId: v.optional(v.id("users")),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_name", ["workspaceId", "name"])
    .index("by_workspaceId_and_ownerId", ["workspaceId", "ownerId"]),

  // A connected source of conversations, owned by exactly one inbox:
  // connecting a channel is how an inbox starts receiving messages. A channel
  // has no visibility of its own — it inherits the inbox's kind and access.
  // Email channels use OAuth; messaging channels currently use sample data.
  channels: defineTable({
    workspaceId: v.id("workspaces"),
    inboxId: v.id("inboxes"),
    provider: v.union(
      v.literal("gmail"),
      v.literal("outlook"),
      v.literal("whatsapp"),
      v.literal("sms"),
    ),
    // Email address or phone number the provider delivers from.
    address: v.string(),
    status: v.union(v.literal("connected"), v.literal("disconnected")),
  })
    .index("by_inboxId", ["inboxId"])
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_address", ["workspaceId", "address"]),

  // The unit of work. Status is open | waiting | closed; the "Assigned" view
  // is derived (status "open" with assigneeId set), never stored.
  threads: defineTable({
    workspaceId: v.id("workspaces"),
    // Legacy: threads belong to a channel, and the channel names the inbox.
    inboxId: v.optional(v.id("inboxes")),
    channelId: v.id("channels"),
    externalThreadId: v.optional(v.string()),
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
    .index("by_channelId_and_lastMessageAt", ["channelId", "lastMessageAt"])
    .index("by_channelId_and_externalThreadId", ["channelId", "externalThreadId"]),

  messages: defineTable({
    // Denormalized from the thread so message authz never skips the tenant check.
    workspaceId: v.id("workspaces"),
    threadId: v.id("threads"),
    externalMessageId: v.optional(v.string()),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    // Set on outbound replies authored in Reply.
    authorId: v.optional(v.id("users")),
    // Set on inbound messages from the customer.
    senderName: v.optional(v.string()),
    senderEmail: v.optional(v.string()),
    body: v.string(),
    sentAt: v.number(),
  })
    .index("by_threadId_and_sentAt", ["threadId", "sentAt"])
    .index("by_threadId_and_externalMessageId", ["threadId", "externalMessageId"]),

  // Per-user unread state, scoped for workspace unread counts.
  threadReads: defineTable({
    workspaceId: v.id("workspaces"),
    // Legacy: unread state is per thread; the thread's channel names the inbox.
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
    // Small bounded list of teammate-uploaded files shown with the comment.
    attachments: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          name: v.string(),
          size: v.number(),
          type: v.string(),
        }),
      ),
    ),
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
    slogan: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    location: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    socials: v.optional(v.array(v.object({ type: v.string(), url: v.string() }))),
    fetchedAt: v.number(),
  }).index("by_workspaceId_and_domain", ["workspaceId", "domain"]),

  mailOauthStates: defineTable({
    stateHash: v.string(),
    codeVerifierEncrypted: v.string(),
    workspaceId: v.id("workspaces"),
    inboxId: v.id("inboxes"),
    channelId: v.optional(v.id("channels")),
    userId: v.id("users"),
    provider: v.union(v.literal("gmail"), v.literal("outlook")),
    expiresAt: v.number(),
  })
    .index("by_stateHash", ["stateHash"])
    .index("by_userId", ["userId"]),

  mailConnections: defineTable({
    workspaceId: v.id("workspaces"),
    inboxId: v.id("inboxes"),
    channelId: v.id("channels"),
    connectedBy: v.id("users"),
    provider: v.union(v.literal("gmail"), v.literal("outlook")),
    providerAccountId: v.string(),
    emailAddress: v.string(),
    accessTokenEncrypted: v.optional(v.string()),
    refreshTokenEncrypted: v.optional(v.string()),
    accessTokenExpiresAt: v.number(),
    scope: v.string(),
    status: v.union(v.literal("connected"), v.literal("disconnected"), v.literal("error")),
    syncStatus: v.union(v.literal("idle"), v.literal("syncing"), v.literal("error")),
    lastSyncedAt: v.optional(v.number()),
    lastSyncError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_inboxId", ["inboxId"])
    .index("by_channelId", ["channelId"])
    .index("by_workspaceId", ["workspaceId"])
    .index("by_workspaceId_and_provider_and_providerAccountId", [
      "workspaceId",
      "provider",
      "providerAccountId",
    ]),
});

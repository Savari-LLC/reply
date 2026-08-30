/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.{ts,js}", "!./**/*.test.ts"]);

type T = TestConvex<typeof schema>;

async function signUp(t: T, username: string) {
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      authProvider: "password",
      providerAccountId: `test|${username}`,
      username,
      name: username,
    }),
  );
  return { userId, asUser: t.withIdentity({ subject: userId }) };
}

async function setupWorkspace(t: T, username = "romi") {
  const { userId, asUser } = await signUp(t, username);
  const workspaceId = await asUser.mutation(api.workspaces.create, {
    name: `${username} workspace`,
  });
  return { userId, asUser, workspaceId };
}

async function joinAsMember(t: T, workspaceId: Id<"workspaces">, username: string) {
  const { userId, asUser } = await signUp(t, username);
  const inviterId = await t.run(async (ctx) => {
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    return memberships.find((m) => m.role === "admin")!.userId;
  });
  await t.run(async (ctx) => {
    await ctx.db.insert("workspaceInvitations", {
      workspaceId,
      email: `${username}@example.test`,
      invitedBy: inviterId,
      tokenHash: `hash-${username}`,
      expiresAt: Date.now() + 60_000,
    });
  });
  await t.mutation(internal.invitations.acceptPrepared, {
    actorSubject: userId,
    tokenHash: `hash-${username}`,
  });
  return { userId, asUser };
}

describe("workspace setup", () => {
  test("creating a workspace creates shared defaults and a personal inbox", async () => {
    const t = convexTest(schema, modules);
    const { asUser } = await setupWorkspace(t);
    const inboxes = await asUser.query(api.inbox.listInboxes, {});
    expect(inboxes.map((inbox) => inbox.kind)).toEqual([
      "personal",
      "shared",
      "shared",
      "shared",
    ]);
    expect(inboxes[0]!.name).toBe("Your inbox");
  });

  test("accepting an invitation creates a personal inbox and shared grants", async () => {
    const t = convexTest(schema, modules);
    const { workspaceId } = await setupWorkspace(t);
    const { asUser: asMember } = await joinAsMember(t, workspaceId, "noor");
    const inboxes = await asMember.query(api.inbox.listInboxes, {});
    expect(inboxes.filter((inbox) => inbox.kind === "personal")).toHaveLength(1);
    expect(inboxes.filter((inbox) => inbox.kind === "shared")).toHaveLength(3);
  });

  test("members cannot see another member's personal inbox", async () => {
    const t = convexTest(schema, modules);
    const { asUser: asAdmin, workspaceId } = await setupWorkspace(t);
    await joinAsMember(t, workspaceId, "noor");
    const adminInboxes = await asAdmin.query(api.inbox.listInboxes, {});
    expect(adminInboxes.filter((inbox) => inbox.kind === "personal")).toHaveLength(1);
  });
});

describe("channels", () => {
  test("connecting a channel to an inbox surfaces threads and demo teammates", async () => {
    const t = convexTest(schema, modules);
    const { asUser } = await setupWorkspace(t);
    const inboxes = await asUser.query(api.inbox.listInboxes, {});
    const sales = inboxes.find((inbox) => inbox.name === "Sales")!;
    // Nothing is connected yet, so the inbox is empty.
    expect(await asUser.query(api.inbox.listThreads, { inboxId: sales._id })).toEqual([]);
    await asUser.mutation(api.channels.connect, {
      inboxId: sales._id,
      provider: "gmail",
      address: "Sales@Example.test",
      dataset: "sales",
    });
    const threads = await asUser.query(api.inbox.listThreads, { inboxId: sales._id });
    expect(threads!.length).toBeGreaterThan(0);
    expect(threads!.some((thread) => thread.senderDomain === "northstar.ae")).toBe(true);
    const teammates = await asUser.query(api.inbox.listTeammates, {});
    expect(teammates.map((tm) => tm.name)).toEqual(
      expect.arrayContaining(["Maya Haddad", "Noah Clarke"]),
    );
    // Assignees resolve to the seeded teammates.
    expect(threads!.some((thread) => thread.assignee !== null)).toBe(true);
    // The channel belongs to the inbox it was connected from, address normalized.
    const settings = await asUser.query(api.inboxes.listSettings, {});
    const salesSettings = settings.find((inbox) => inbox._id === sales._id)!;
    expect(salesSettings.channels).toHaveLength(1);
    expect(salesSettings.channels[0]!.address).toBe("sales@example.test");
    expect(salesSettings.channels[0]!.provider).toBe("gmail");
  });

  test("every provider connects, and addresses are validated per provider", async () => {
    const t = convexTest(schema, modules);
    const { asUser } = await setupWorkspace(t);
    const inboxes = await asUser.query(api.inbox.listInboxes, {});
    const support = inboxes.find((inbox) => inbox.name === "Support")!;
    await asUser.mutation(api.channels.connect, {
      inboxId: support._id,
      provider: "outlook",
      address: "support@example.test",
      dataset: "support",
    });
    await asUser.mutation(api.channels.connect, {
      inboxId: support._id,
      provider: "whatsapp",
      address: "+971 50 123 4567",
      dataset: "support",
    });
    await asUser.mutation(api.channels.connect, {
      inboxId: support._id,
      provider: "sms",
      address: "441632960001",
      dataset: "support",
    });
    const settings = await asUser.query(api.inboxes.listSettings, {});
    const channels = settings.find((inbox) => inbox._id === support._id)!.channels;
    expect(channels.map((channel) => channel.address)).toEqual([
      "support@example.test",
      "+971501234567",
      "+441632960001",
    ]);
    // A phone number is not a mailbox, and vice versa.
    await expect(
      asUser.mutation(api.channels.connect, {
        inboxId: support._id,
        provider: "gmail",
        address: "+971501234500",
        dataset: "support",
      }),
    ).rejects.toThrow(/valid Gmail address/);
    await expect(
      asUser.mutation(api.channels.connect, {
        inboxId: support._id,
        provider: "sms",
        address: "not-a-number",
        dataset: "support",
      }),
    ).rejects.toThrow(/valid SMS phone number/);
  });

  test("an address can only be connected once per workspace", async () => {
    const t = convexTest(schema, modules);
    const { asUser } = await setupWorkspace(t);
    const inboxes = await asUser.query(api.inbox.listInboxes, {});
    const sales = inboxes.find((inbox) => inbox.name === "Sales")!;
    const support = inboxes.find((inbox) => inbox.name === "Support")!;
    await asUser.mutation(api.channels.connect, {
      inboxId: sales._id,
      provider: "gmail",
      address: "shared@example.test",
      dataset: "sales",
    });
    await expect(
      asUser.mutation(api.channels.connect, {
        inboxId: support._id,
        provider: "outlook",
        address: "shared@example.test",
        dataset: "support",
      }),
    ).rejects.toThrow(/already connected/);
  });

  test("members connect channels to their own inbox but not to a shared one", async () => {
    const t = convexTest(schema, modules);
    const { workspaceId } = await setupWorkspace(t);
    const { asUser: asMember } = await joinAsMember(t, workspaceId, "noor");
    const inboxes = await asMember.query(api.inbox.listInboxes, {});
    const personal = inboxes.find((inbox) => inbox.kind === "personal")!;
    const shared = inboxes.find((inbox) => inbox.kind === "shared")!;
    await expect(
      asMember.mutation(api.channels.connect, {
        inboxId: shared._id,
        provider: "gmail",
        address: "team@example.test",
        dataset: "sales",
      }),
    ).rejects.toThrow(/not found/i);
    await asMember.mutation(api.channels.connect, {
      inboxId: personal._id,
      provider: "gmail",
      address: "noor@example.test",
      dataset: "support",
    });
    const threads = await asMember.query(api.inbox.listThreads, { inboxId: personal._id });
    expect(threads!.length).toBeGreaterThan(0);
  });

  test("a channel is invisible to members without access to its inbox", async () => {
    const t = convexTest(schema, modules);
    const { asUser: asAdmin, workspaceId } = await setupWorkspace(t);
    const { asUser: asMember, userId: memberId } = await joinAsMember(t, workspaceId, "noor");
    const inboxes = await asAdmin.query(api.inbox.listInboxes, {});
    const sales = inboxes.find((inbox) => inbox.name === "Sales")!;
    const channelId = await asAdmin.mutation(api.channels.connect, {
      inboxId: sales._id,
      provider: "gmail",
      address: "sales@example.test",
      dataset: "sales",
    });
    // The member inherits access from the inbox, not from the channel.
    expect(
      (await asMember.query(api.inboxes.listSettings, {})).some(
        (inbox) => inbox._id === sales._id,
      ),
    ).toBe(true);
    await asAdmin.mutation(api.inboxes.setAccess, {
      inboxId: sales._id,
      userId: memberId,
      allowed: false,
    });
    expect(
      (await asMember.query(api.inboxes.listSettings, {})).some(
        (inbox) => inbox._id === sales._id,
      ),
    ).toBe(false);
    // Nor can they disconnect a channel in an inbox they do not manage.
    await expect(
      asMember.mutation(api.channels.disconnect, { channelId }),
    ).rejects.toThrow(/not found/i);
  });

  test("disconnecting a channel removes its conversations", async () => {
    const t = convexTest(schema, modules);
    const { asUser } = await setupWorkspace(t);
    const inboxes = await asUser.query(api.inbox.listInboxes, {});
    const sales = inboxes.find((inbox) => inbox.name === "Sales")!;
    const channelId = await asUser.mutation(api.channels.connect, {
      inboxId: sales._id,
      provider: "gmail",
      address: "sales@example.test",
      dataset: "sales",
    });
    await asUser.mutation(api.channels.disconnect, { channelId });
    expect(await asUser.query(api.inbox.listThreads, { inboxId: sales._id })).toEqual([]);
  });

  test("a user in another workspace cannot touch this workspace's channels", async () => {
    const t = convexTest(schema, modules);
    const { asUser } = await setupWorkspace(t);
    const inboxes = await asUser.query(api.inbox.listInboxes, {});
    const sales = inboxes.find((inbox) => inbox.name === "Sales")!;
    const channelId = await asUser.mutation(api.channels.connect, {
      inboxId: sales._id,
      provider: "gmail",
      address: "sales@example.test",
      dataset: "sales",
    });
    const { asUser: asOutsider } = await setupWorkspace(t, "mallory");
    await expect(
      asOutsider.mutation(api.channels.disconnect, { channelId }),
    ).rejects.toThrow(/not found/i);
    await expect(
      asOutsider.mutation(api.channels.connect, {
        inboxId: sales._id,
        provider: "gmail",
        address: "mallory@example.test",
        dataset: "sales",
      }),
    ).rejects.toThrow(/not found/i);
    expect(
      await asOutsider.query(api.inbox.listThreads, { inboxId: sales._id }),
    ).toBeNull();
  });
});

describe("members", () => {
  test("admins can change roles but the last admin is protected", async () => {
    const t = convexTest(schema, modules);
    const { asUser: asAdmin, userId: adminId, workspaceId } = await setupWorkspace(t);
    const { userId: memberId } = await joinAsMember(t, workspaceId, "noor");
    await expect(
      asAdmin.mutation(api.members.setRole, { userId: adminId, role: "member" }),
    ).rejects.toThrow(/at least one admin/);
    await asAdmin.mutation(api.members.setRole, { userId: memberId, role: "admin" });
    const members = await asAdmin.query(api.members.list, {});
    expect(members.filter((member) => member.role === "admin")).toHaveLength(2);
  });

  test("members cannot manage roles or remove people", async () => {
    const t = convexTest(schema, modules);
    const { userId: adminId, workspaceId } = await setupWorkspace(t);
    const { asUser: asMember, userId: memberId } = await joinAsMember(t, workspaceId, "noor");
    await expect(
      asMember.mutation(api.members.setRole, { userId: memberId, role: "admin" }),
    ).rejects.toThrow(/admin/);
    await expect(
      asMember.mutation(api.members.remove, { userId: adminId }),
    ).rejects.toThrow(/admin/);
  });

  test("removing a member cleans up their personal inbox, grants, and assignments", async () => {
    const t = convexTest(schema, modules);
    const { asUser: asAdmin, workspaceId } = await setupWorkspace(t);
    const { asUser: asMember, userId: memberId } = await joinAsMember(t, workspaceId, "noor");
    const memberInboxes = await asMember.query(api.inbox.listInboxes, {});
    const shared = memberInboxes.find((inbox) => inbox.kind === "shared")!;
    await asAdmin.mutation(api.channels.connect, {
      inboxId: shared._id,
      provider: "gmail",
      address: "sales@example.test",
      dataset: "sales",
    });
    const threads = await asAdmin.query(api.inbox.listThreads, { inboxId: shared._id });
    await asAdmin.mutation(api.inbox.assign, {
      threadId: threads![0]!._id,
      teammateId: memberId,
    });
    await asAdmin.mutation(api.members.remove, { userId: memberId });
    const after = await asAdmin.query(api.inbox.listThreads, { inboxId: shared._id });
    expect(after!.find((thread) => thread._id === threads![0]!._id)!.assignee).toBeNull();
    await t.run(async (ctx) => {
      const memberships = await ctx.db
        .query("memberships")
        .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
        .collect();
      expect(memberships.some((m) => m.userId === memberId)).toBe(false);
      const personal = await ctx.db
        .query("inboxes")
        .withIndex("by_workspaceId_and_ownerId", (q) =>
          q.eq("workspaceId", workspaceId).eq("ownerId", memberId),
        )
        .collect();
      expect(personal).toHaveLength(0);
    });
  });
});

describe("inbox management and access", () => {
  test("admins create shared inboxes; members cannot", async () => {
    const t = convexTest(schema, modules);
    const { asUser: asAdmin, workspaceId } = await setupWorkspace(t);
    const { asUser: asMember } = await joinAsMember(t, workspaceId, "noor");
    await asAdmin.mutation(api.inboxes.create, { name: "Partnerships", kind: "shared" });
    await expect(
      asMember.mutation(api.inboxes.create, { name: "Rogue", kind: "shared" }),
    ).rejects.toThrow(/admin/);
    await expect(
      asAdmin.mutation(api.inboxes.create, { name: "Partnerships", kind: "shared" }),
    ).rejects.toThrow(/already exists/);
  });

  test("anyone creates personal inboxes, and names collide only per owner", async () => {
    const t = convexTest(schema, modules);
    const { asUser: asAdmin, workspaceId } = await setupWorkspace(t);
    const { asUser: asMember } = await joinAsMember(t, workspaceId, "noor");
    await asMember.mutation(api.inboxes.create, { name: "Newsletters", kind: "personal" });
    await expect(
      asMember.mutation(api.inboxes.create, { name: "Newsletters", kind: "personal" }),
    ).rejects.toThrow(/already exists/);
    // Another member's identically named personal inbox is fine and invisible.
    await asAdmin.mutation(api.inboxes.create, { name: "Newsletters", kind: "personal" });
    const memberInboxes = await asMember.query(api.inbox.listInboxes, {});
    expect(
      memberInboxes.filter((inbox) => inbox.name === "Newsletters"),
    ).toHaveLength(1);
  });

  test("revoking access hides a shared inbox from a member", async () => {
    const t = convexTest(schema, modules);
    const { asUser: asAdmin, workspaceId } = await setupWorkspace(t);
    const { asUser: asMember, userId: memberId } = await joinAsMember(t, workspaceId, "noor");
    const inboxes = await asMember.query(api.inbox.listInboxes, {});
    const sales = inboxes.find((inbox) => inbox.name === "Sales")!;
    await asAdmin.mutation(api.inboxes.setAccess, {
      inboxId: sales._id,
      userId: memberId,
      allowed: false,
    });
    const after = await asMember.query(api.inbox.listInboxes, {});
    expect(after.some((inbox) => inbox._id === sales._id)).toBe(false);
    expect(await asMember.query(api.inbox.listThreads, { inboxId: sales._id })).toBeNull();
    await asAdmin.mutation(api.inboxes.setAccess, {
      inboxId: sales._id,
      userId: memberId,
      allowed: true,
    });
    const restored = await asMember.query(api.inbox.listInboxes, {});
    expect(restored.some((inbox) => inbox._id === sales._id)).toBe(true);
  });

  test("deleting an inbox takes its channels and conversations with it", async () => {
    const t = convexTest(schema, modules);
    const { asUser: asAdmin } = await setupWorkspace(t);
    const inboxes = await asAdmin.query(api.inbox.listInboxes, {});
    const support = inboxes.find((inbox) => inbox.name === "Support")!;
    const sales = inboxes.find((inbox) => inbox.name === "Sales")!;
    await asAdmin.mutation(api.channels.connect, {
      inboxId: support._id,
      provider: "outlook",
      address: "support@example.test",
      dataset: "support",
    });
    await asAdmin.mutation(api.channels.connect, {
      inboxId: sales._id,
      provider: "gmail",
      address: "sales@example.test",
      dataset: "sales",
    });
    await asAdmin.mutation(api.inboxes.remove, { inboxId: support._id });
    const after = await asAdmin.query(api.inbox.listInboxes, {});
    expect(after.some((inbox) => inbox._id === support._id)).toBe(false);
    // Other inboxes own their own channels and are untouched.
    expect(
      (await asAdmin.query(api.inbox.listThreads, { inboxId: sales._id }))!.length,
    ).toBeGreaterThan(0);
    await t.run(async (ctx) => {
      const channels = await ctx.db.query("channels").collect();
      expect(channels.every((channel) => channel.inboxId === sales._id)).toBe(true);
      const threads = await ctx.db.query("threads").collect();
      expect(threads.every((thread) => thread.channelId === channels[0]!._id)).toBe(true);
    });
  });

  test("a member's last personal inbox is protected, extra ones are not", async () => {
    const t = convexTest(schema, modules);
    const { asUser: asAdmin, userId: adminId } = await setupWorkspace(t);
    const inboxes = await asAdmin.query(api.inbox.listInboxes, {});
    const personal = inboxes.find((inbox) => inbox.kind === "personal")!;
    await expect(
      asAdmin.mutation(api.inboxes.remove, { inboxId: personal._id }),
    ).rejects.toThrow(/last personal inbox/);
    const extra = await asAdmin.mutation(api.inboxes.create, {
      name: "Newsletters",
      kind: "personal",
    });
    await asAdmin.mutation(api.inboxes.remove, { inboxId: extra });
    // Personal inboxes are never shared with anyone.
    await expect(
      asAdmin.mutation(api.inboxes.setAccess, {
        inboxId: personal._id,
        userId: adminId,
        allowed: true,
      }),
    ).rejects.toThrow(/private/);
  });

  test("a member cannot delete or rename a shared inbox", async () => {
    const t = convexTest(schema, modules);
    const { workspaceId } = await setupWorkspace(t);
    const { asUser: asMember } = await joinAsMember(t, workspaceId, "noor");
    const inboxes = await asMember.query(api.inbox.listInboxes, {});
    const shared = inboxes.find((inbox) => inbox.kind === "shared")!;
    await expect(
      asMember.mutation(api.inboxes.remove, { inboxId: shared._id }),
    ).rejects.toThrow(/not found/i);
    await expect(
      asMember.mutation(api.inboxes.rename, { inboxId: shared._id, name: "Mine now" }),
    ).rejects.toThrow(/not found/i);
  });
});

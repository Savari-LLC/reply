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
  test("creating a sample channel and linking it surfaces threads and demo teammates", async () => {
    const t = convexTest(schema, modules);
    const { asUser } = await setupWorkspace(t);
    const inboxes = await asUser.query(api.inbox.listInboxes, {});
    const sales = inboxes.find((inbox) => inbox.name === "Sales")!;
    const channelId = await asUser.mutation(api.channels.create, {
      name: "Sales mail",
      provider: "demo",
      dataset: "sales",
      kind: "shared",
    });
    // Not linked yet: the inbox stays empty.
    expect(await asUser.query(api.inbox.listThreads, { inboxId: sales._id })).toEqual([]);
    await asUser.mutation(api.channels.link, { inboxId: sales._id, channelId });
    const threads = await asUser.query(api.inbox.listThreads, { inboxId: sales._id });
    expect(threads!.length).toBeGreaterThan(0);
    expect(threads!.some((thread) => thread.senderDomain === "northstar.ae")).toBe(true);
    const teammates = await asUser.query(api.inbox.listTeammates, {});
    expect(teammates.map((tm) => tm.name)).toEqual(
      expect.arrayContaining(["Maya Haddad", "Noah Clarke"]),
    );
    // Assignees resolve to the seeded teammates.
    expect(threads!.some((thread) => thread.assignee !== null)).toBe(true);
  });

  test("gmail and outlook are not connectable yet", async () => {
    const t = convexTest(schema, modules);
    const { asUser } = await setupWorkspace(t);
    await expect(
      asUser.mutation(api.channels.create, { name: "Work mail", provider: "gmail", kind: "shared" }),
    ).rejects.toThrow(/coming soon/);
    await expect(
      asUser.mutation(api.channels.create, { name: "Work mail", provider: "outlook", kind: "shared" }),
    ).rejects.toThrow(/coming soon/);
  });

  test("one channel can feed several inboxes at once", async () => {
    const t = convexTest(schema, modules);
    const { asUser } = await setupWorkspace(t);
    const inboxes = await asUser.query(api.inbox.listInboxes, {});
    const sales = inboxes.find((inbox) => inbox.name === "Sales")!;
    const personal = inboxes.find((inbox) => inbox.kind === "personal")!;
    const channelId = await asUser.mutation(api.channels.create, {
      name: "Sales mail",
      provider: "demo",
      dataset: "sales",
      kind: "shared",
    });
    await asUser.mutation(api.channels.link, { inboxId: sales._id, channelId });
    await asUser.mutation(api.channels.link, { inboxId: personal._id, channelId });
    const salesThreads = await asUser.query(api.inbox.listThreads, { inboxId: sales._id });
    const personalThreads = await asUser.query(api.inbox.listThreads, { inboxId: personal._id });
    expect(personalThreads!.map((thread) => thread._id).sort()).toEqual(
      salesThreads!.map((thread) => thread._id).sort(),
    );
    await asUser.mutation(api.channels.unlink, { inboxId: personal._id, channelId });
    expect(await asUser.query(api.inbox.listThreads, { inboxId: personal._id })).toEqual([]);
    // Unlinking never deletes the conversations.
    expect((await asUser.query(api.inbox.listThreads, { inboxId: sales._id }))!.length).toBe(
      salesThreads!.length,
    );
  });

  test("members create personal channels and link them to their own inbox only", async () => {
    const t = convexTest(schema, modules);
    const { workspaceId } = await setupWorkspace(t);
    const { asUser: asMember } = await joinAsMember(t, workspaceId, "noor");
    await expect(
      asMember.mutation(api.channels.create, { name: "Team mail", provider: "demo", kind: "shared" }),
    ).rejects.toThrow(/admin/);
    const channelId = await asMember.mutation(api.channels.create, {
      name: "My mail",
      provider: "demo",
      dataset: "support",
      kind: "personal",
    });
    const inboxes = await asMember.query(api.inbox.listInboxes, {});
    const personal = inboxes.find((inbox) => inbox.kind === "personal")!;
    const shared = inboxes.find((inbox) => inbox.kind === "shared")!;
    await expect(
      asMember.mutation(api.channels.link, { inboxId: shared._id, channelId }),
    ).rejects.toThrow(/not found/i);
    await asMember.mutation(api.channels.link, { inboxId: personal._id, channelId });
    const threads = await asMember.query(api.inbox.listThreads, { inboxId: personal._id });
    expect(threads!.length).toBeGreaterThan(0);
  });

  test("channel access controls who can see and link a shared channel", async () => {
    const t = convexTest(schema, modules);
    const { asUser: asAdmin, workspaceId } = await setupWorkspace(t);
    const { asUser: asMember, userId: memberId } = await joinAsMember(t, workspaceId, "noor");
    const channelId = await asAdmin.mutation(api.channels.create, {
      name: "Sales mail",
      provider: "demo",
      dataset: "sales",
      kind: "shared",
    });
    // No grant yet: invisible and unlinkable for the member.
    expect(
      (await asMember.query(api.channels.listSettings, {})).some((c) => c._id === channelId),
    ).toBe(false);
    const memberInboxes = await asMember.query(api.inbox.listInboxes, {});
    const personal = memberInboxes.find((inbox) => inbox.kind === "personal")!;
    await expect(
      asMember.mutation(api.channels.link, { inboxId: personal._id, channelId }),
    ).rejects.toThrow(/not found/i);
    await asAdmin.mutation(api.channels.setAccess, { channelId, userId: memberId, allowed: true });
    expect(
      (await asMember.query(api.channels.listSettings, {})).some((c) => c._id === channelId),
    ).toBe(true);
    await asMember.mutation(api.channels.link, { inboxId: personal._id, channelId });
    expect(
      (await asMember.query(api.inbox.listThreads, { inboxId: personal._id }))!.length,
    ).toBeGreaterThan(0);
    // Members never manage shared-channel permissions.
    await expect(
      asMember.mutation(api.channels.setAccess, { channelId, userId: memberId, allowed: false }),
    ).rejects.toThrow(/admin/);
  });

  test("personal channels are invisible to other members and admins", async () => {
    const t = convexTest(schema, modules);
    const { asUser: asAdmin, userId: adminId, workspaceId } = await setupWorkspace(t);
    const { asUser: asMember } = await joinAsMember(t, workspaceId, "noor");
    const channelId = await asMember.mutation(api.channels.create, {
      name: "My mail",
      provider: "demo",
      dataset: "support",
      kind: "personal",
    });
    expect(
      (await asAdmin.query(api.channels.listSettings, {})).some((c) => c._id === channelId),
    ).toBe(false);
    await expect(
      asAdmin.mutation(api.channels.setAccess, { channelId, userId: adminId, allowed: true }),
    ).rejects.toThrow(/private/i);
  });

  test("deleting a channel removes its conversations from every inbox", async () => {
    const t = convexTest(schema, modules);
    const { asUser } = await setupWorkspace(t);
    const inboxes = await asUser.query(api.inbox.listInboxes, {});
    const sales = inboxes.find((inbox) => inbox.name === "Sales")!;
    const channelId = await asUser.mutation(api.channels.create, {
      name: "Sales mail",
      provider: "demo",
      dataset: "sales",
      kind: "shared",
    });
    await asUser.mutation(api.channels.link, { inboxId: sales._id, channelId });
    await asUser.mutation(api.channels.remove, { channelId });
    expect(await asUser.query(api.inbox.listThreads, { inboxId: sales._id })).toEqual([]);
  });

  test("a user in another workspace cannot touch this workspace's channels", async () => {
    const t = convexTest(schema, modules);
    const { asUser } = await setupWorkspace(t);
    const inboxes = await asUser.query(api.inbox.listInboxes, {});
    const sales = inboxes.find((inbox) => inbox.name === "Sales")!;
    const channelId = await asUser.mutation(api.channels.create, {
      name: "Sales mail",
      provider: "demo",
      dataset: "sales",
      kind: "shared",
    });
    await asUser.mutation(api.channels.link, { inboxId: sales._id, channelId });
    const { asUser: asOutsider } = await setupWorkspace(t, "mallory");
    await expect(
      asOutsider.mutation(api.channels.remove, { channelId }),
    ).rejects.toThrow(/not found/i);
    await expect(
      asOutsider.mutation(api.channels.link, { inboxId: sales._id, channelId }),
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
    const channelId = await asAdmin.mutation(api.channels.create, {
      name: "Sales mail",
      provider: "demo",
      dataset: "sales",
      kind: "shared",
    });
    await asAdmin.mutation(api.channels.link, { inboxId: shared._id, channelId });
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
    await asAdmin.mutation(api.inboxes.create, { name: "Partnerships" });
    await expect(
      asMember.mutation(api.inboxes.create, { name: "Rogue" }),
    ).rejects.toThrow(/admin/);
    await expect(
      asAdmin.mutation(api.inboxes.create, { name: "Partnerships" }),
    ).rejects.toThrow(/already exists/);
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

  test("deleting an inbox keeps its channels and their conversations", async () => {
    const t = convexTest(schema, modules);
    const { asUser: asAdmin } = await setupWorkspace(t);
    const inboxes = await asAdmin.query(api.inbox.listInboxes, {});
    const support = inboxes.find((inbox) => inbox.name === "Support")!;
    const sales = inboxes.find((inbox) => inbox.name === "Sales")!;
    const channelId = await asAdmin.mutation(api.channels.create, {
      name: "Support mail",
      provider: "demo",
      dataset: "support",
      kind: "shared",
    });
    await asAdmin.mutation(api.channels.link, { inboxId: support._id, channelId });
    await asAdmin.mutation(api.channels.link, { inboxId: sales._id, channelId });
    await asAdmin.mutation(api.inboxes.remove, { inboxId: support._id });
    const after = await asAdmin.query(api.inbox.listInboxes, {});
    expect(after.some((inbox) => inbox._id === support._id)).toBe(false);
    // The channel is workspace-level: its threads still flow into Sales.
    expect(
      (await asAdmin.query(api.inbox.listThreads, { inboxId: sales._id }))!.length,
    ).toBeGreaterThan(0);
  });

  test("personal inboxes cannot be deleted or shared", async () => {
    const t = convexTest(schema, modules);
    const { asUser: asAdmin, userId: adminId } = await setupWorkspace(t);
    const inboxes = await asAdmin.query(api.inbox.listInboxes, {});
    const personal = inboxes.find((inbox) => inbox.kind === "personal")!;
    await expect(
      asAdmin.mutation(api.inboxes.remove, { inboxId: personal._id }),
    ).rejects.toThrow(/cannot be deleted/);
    await expect(
      asAdmin.mutation(api.inboxes.setAccess, {
        inboxId: personal._id,
        userId: adminId,
        allowed: true,
      }),
    ).rejects.toThrow(/private/);
  });
});

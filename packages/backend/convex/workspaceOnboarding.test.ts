/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob([
  "./**/*.{ts,js}",
  "!./**/*.test.ts",
]);

type TestClient = ReturnType<typeof convexTest>;

async function createUser(t: TestClient, username: string) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      authProvider: "password",
      providerAccountId: `test|${username}`,
      username,
      name: username,
    });
  });
}

async function createGoogleUser(t: TestClient, email: string) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      authProvider: "google",
      providerAccountId: `google|${email}`,
      username: email,
      name: email,
      email,
    });
  });
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("workspace onboarding", () => {
  test("creates one workspace and admin membership for the signed-in user", async () => {
    const t = convexTest(schema, modules);

    await expect(t.mutation(api.workspaces.create, { name: "Acme Support" })).rejects.toThrow(
      "Your account could not be found",
    );

    const userId = await createUser(t, "maya");
    const asUser = t.withIdentity({ subject: userId });
    const workspaceId = await asUser.mutation(api.workspaces.create, { name: "  Acme   Support  " });
    const repeatedId = await asUser.mutation(api.workspaces.create, { name: "Another workspace" });

    expect(repeatedId).toBe(workspaceId);
    await expect(asUser.query(api.workspaces.getCurrent, {})).resolves.toMatchObject({
      workspace: { _id: workspaceId, name: "Acme Support", slug: "acme-support" },
      membership: { userId, role: "admin" },
      memberCount: 1,
    });

    const inboxNames = await t.run(async (ctx) => {
      const inboxes = await ctx.db
        .query("inboxes")
        .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
        .collect();
      return inboxes.map((inbox) => inbox.name).sort();
    });
    expect(inboxNames).toEqual(["Accounts", "Sales", "Support"]);
  });

  test("accepts a single-use invitation and rejects reuse by another account", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "admin");
    const inviteeId = await createUser(t, "invitee");
    const otherUserId = await createUser(t, "other");
    const workspaceId = await t
      .withIdentity({ subject: adminId })
      .mutation(api.workspaces.create, { name: "Reply Team" });
    const token = "a".repeat(64);
    const tokenHash = await hashToken(token);

    await t.mutation(internal.invitations.prepare, {
      actorSubject: adminId,
      workspaceId,
      email: "invitee@example.com",
      tokenHash,
      expiresAt: Date.now() + 60_000,
    });

    const accepted = await t
      .withIdentity({ subject: inviteeId })
      .action(api.invitations.accept, { token });
    expect(accepted).toMatchObject({ workspaceId, workspaceName: "Reply Team", alreadyMember: false });

    const acceptedAgain = await t
      .withIdentity({ subject: inviteeId })
      .action(api.invitations.accept, { token });
    expect(acceptedAgain.alreadyMember).toBe(true);

    await expect(
      t.withIdentity({ subject: otherUserId }).action(api.invitations.accept, { token }),
    ).rejects.toThrow("This invitation has already been used");

    const membership = await t.run(async (ctx) => {
      return await ctx.db
        .query("memberships")
        .withIndex("by_workspaceId_and_userId", (q) =>
          q.eq("workspaceId", workspaceId).eq("userId", inviteeId),
        )
        .unique();
    });
    expect(membership?.role).toBe("member");
  });

  test("allows only admins to create invitations", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "admin");
    const memberId = await createUser(t, "member");
    const workspaceId = await t
      .withIdentity({ subject: adminId })
      .mutation(api.workspaces.create, { name: "Secure Team" });

    await t.run(async (ctx) => {
      await ctx.db.insert("memberships", {
        workspaceId,
        userId: memberId,
        role: "member",
      });
    });

    await expect(
      t.mutation(internal.invitations.prepare, {
        actorSubject: memberId,
        workspaceId,
        email: "person@example.com",
        tokenHash: await hashToken("b".repeat(64)),
        expiresAt: Date.now() + 60_000,
      }),
    ).rejects.toThrow("Only a workspace admin can invite members");
    await expect(
      t.withIdentity({ subject: memberId }).action(api.invitations.send, {
        emails: ["person@example.com"],
      }),
    ).rejects.toThrow("Only a workspace admin can invite members");
    await expect(
      t.action(api.invitations.send, { emails: ["person@example.com"] }),
    ).rejects.toThrow("Sign in to continue");

    const invitations = await t
      .withIdentity({ subject: memberId })
      .query(api.invitations.listCurrent, {});
    expect(invitations).toEqual([]);
  });

  test("requires a Google account matching the invited email", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "admin");
    const wrongGoogleUserId = await createGoogleUser(t, "other@example.com");
    const workspaceId = await t
      .withIdentity({ subject: adminId })
      .mutation(api.workspaces.create, { name: "Google Team" });
    const token = "d".repeat(64);

    await t.mutation(internal.invitations.prepare, {
      actorSubject: adminId,
      workspaceId,
      email: "invitee@example.com",
      tokenHash: await hashToken(token),
      expiresAt: Date.now() + 60_000,
    });

    await expect(
      t.withIdentity({ subject: wrongGoogleUserId }).action(api.invitations.accept, { token }),
    ).rejects.toThrow("Sign in with the Google account that received this invitation");
  });

  test("rejects expired invitations", async () => {
    const t = convexTest(schema, modules);
    const adminId = await createUser(t, "admin");
    const inviteeId = await createUser(t, "invitee");
    const workspaceId: Id<"workspaces"> = await t
      .withIdentity({ subject: adminId })
      .mutation(api.workspaces.create, { name: "Expired Team" });
    const token = "c".repeat(64);

    await t.mutation(internal.invitations.prepare, {
      actorSubject: adminId,
      workspaceId,
      email: "invitee@example.com",
      tokenHash: await hashToken(token),
      expiresAt: Date.now() - 1,
    });

    await expect(
      t.withIdentity({ subject: inviteeId }).action(api.invitations.accept, { token }),
    ).rejects.toThrow("This invitation has expired");
  });
});

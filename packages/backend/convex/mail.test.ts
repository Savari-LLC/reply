/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.{ts,js}", "!./**/*.test.ts"]);
type TestClient = ReturnType<typeof convexTest>;

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

async function createUser(t: TestClient, username: string) {
  return await t.run(async (ctx) =>
    ctx.db.insert("users", {
      authProvider: "password",
      providerAccountId: `test|${username}`,
      username,
      name: username,
    }),
  );
}

async function createWorkspace(t: TestClient, username = "admin") {
  const userId = await createUser(t, username);
  const asUser = t.withIdentity({ subject: userId });
  const workspaceId = await asUser.mutation(api.workspaces.create, {
    name: `${username} workspace`,
  });
  const inboxes = await asUser.query(api.inbox.listInboxes, {});
  const inboxId = inboxes.find((inbox) => inbox.name === "Sales")?._id;
  if (!inboxId) throw new Error("Sales inbox was not created");
  return { asUser, inboxId, userId, workspaceId };
}

async function connectMailbox(
  t: TestClient,
  workspaceId: Id<"workspaces">,
  inboxId: Id<"inboxes">,
  userId: Id<"users">,
) {
  return await t.mutation(internal.mail.completeOauth, {
    workspaceId,
    inboxId,
    channelId: null,
    userId,
    provider: "gmail",
    providerAccountId: "owner@example.com",
    emailAddress: "owner@example.com",
    accessTokenEncrypted: "encrypted-access-token",
    refreshTokenEncrypted: "encrypted-refresh-token",
    accessTokenExpiresAt: 2_000_000_000_000,
    scope: "gmail.readonly",
  });
}

describe("mail channels", () => {
  test("allows only managers to prepare inbox OAuth state", async () => {
    const t = convexTest(schema, modules);
    const { inboxId, userId, workspaceId } = await createWorkspace(t);
    const memberId = await createUser(t, "member");
    await t.run(async (ctx) => {
      await ctx.db.insert("memberships", { workspaceId, userId: memberId, role: "member" });
    });

    await expect(
      t.mutation(internal.mail.prepareOauth, {
        actorSubject: memberId,
        inboxId,
        provider: "gmail",
        stateHash: "member-state",
        codeVerifierEncrypted: "encrypted-verifier",
        expiresAt: 20_000,
      }),
    ).rejects.toThrow("Inbox not found");

    await t.mutation(internal.mail.prepareOauth, {
      actorSubject: userId,
      inboxId,
      provider: "gmail",
      stateHash: "admin-state",
      codeVerifierEncrypted: "encrypted-verifier",
      expiresAt: 20_000,
    });
    await expect(
      t.mutation(internal.mail.consumeOauthState, {
        stateHash: "admin-state",
        now: 10_000,
      }),
    ).resolves.toMatchObject({
      inboxId,
      channelId: null,
      userId,
      provider: "gmail",
    });
    await expect(
      t.mutation(internal.mail.consumeOauthState, {
        stateHash: "admin-state",
        now: 10_000,
      }),
    ).rejects.toThrow("invalid or already used");
  });

  test("rejects live connections in a demo workspace", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t, "demo-admin");
    const { inboxId, workspaceId } = await t.run(async (ctx) => {
      const workspaceId = await ctx.db.insert("workspaces", {
        name: "Demo",
        slug: "demo-mail-test",
        demoSeed: true,
      });
      await ctx.db.insert("memberships", { workspaceId, userId, role: "admin" });
      const inboxId = await ctx.db.insert("inboxes", {
        workspaceId,
        name: "Sales",
        kind: "shared",
      });
      return { inboxId, workspaceId };
    });

    await expect(
      t.mutation(internal.mail.prepareOauth, {
        actorSubject: userId,
        inboxId,
        provider: "gmail",
        stateHash: "demo-state",
        codeVerifierEncrypted: "encrypted-verifier",
        expiresAt: 20_000,
      }),
    ).rejects.toThrow("disabled for the demo workspace");
    await expect(
      t.mutation(internal.mail.completeOauth, {
        workspaceId,
        inboxId,
        channelId: null,
        userId,
        provider: "gmail",
        providerAccountId: "owner@example.com",
        emailAddress: "owner@example.com",
        accessTokenEncrypted: "encrypted-access-token",
        refreshTokenEncrypted: "encrypted-refresh-token",
        accessTokenExpiresAt: 2_000_000_000_000,
        scope: "gmail.readonly",
      }),
    ).rejects.toThrow("disabled for the demo workspace");
  });

  test("imports provider threads idempotently into the owning inbox", async () => {
    const t = convexTest(schema, modules);
    const { asUser, inboxId, userId, workspaceId } = await createWorkspace(t);
    const { connectionId } = await connectMailbox(t, workspaceId, inboxId, userId);
    const importedThread = {
      externalThreadId: "gmail:thread-1",
      subject: "Need help",
      senderName: "Customer",
      senderEmail: "customer@acme.test",
      lastMessageAt: 1_000,
      unread: true,
      messages: [
        {
          externalMessageId: "gmail:message-1",
          direction: "inbound" as const,
          senderName: "Customer",
          senderEmail: "customer@acme.test",
          body: "Can you help?",
          sentAt: 1_000,
        },
      ],
    };

    await expect(
      t.mutation(internal.mail.upsertImportedThread, { connectionId, thread: importedThread }),
    ).resolves.toEqual({ insertedThread: true, insertedMessages: 1 });
    await expect(
      t.mutation(internal.mail.upsertImportedThread, { connectionId, thread: importedThread }),
    ).resolves.toEqual({ insertedThread: false, insertedMessages: 0 });

    const threads = await asUser.query(api.inbox.listThreads, { inboxId });
    expect(threads).toHaveLength(1);
    expect(threads?.[0]).toMatchObject({
      subject: "Need help",
      senderEmail: "customer@acme.test",
      unread: true,
      preview: "Can you help?",
    });
    const detail = await asUser.query(api.inbox.getThread, { threadId: threads![0]!._id });
    expect(detail?.messages).toHaveLength(1);
    expect(detail?.messages[0]).toMatchObject({ direction: "inbound", body: "Can you help?" });
  });

  test("keeps credentials internal and clears them on disconnect", async () => {
    const t = convexTest(schema, modules);
    const { asUser, inboxId, userId, workspaceId } = await createWorkspace(t);
    const { channelId, connectionId } = await connectMailbox(t, workspaceId, inboxId, userId);

    const settings = await asUser.query(api.inboxes.listSettings, {});
    const channel = settings
      .find((inbox) => inbox._id === inboxId)
      ?.channels.find((candidate) => candidate._id === channelId);
    expect(channel).toMatchObject({
      provider: "gmail",
      address: "owner@example.com",
      status: "connected",
      mailConnection: { syncStatus: "idle", lastSyncedAt: null },
    });
    expect(channel).not.toHaveProperty("accessTokenEncrypted");
    expect(channel).not.toHaveProperty("refreshTokenEncrypted");

    const otherUserId = await createUser(t, "other-workspace-user");
    await expect(
      t.withIdentity({ subject: otherUserId }).mutation(api.mail.disconnect, { channelId }),
    ).rejects.toThrow("Join a workspace");
    await expect(t.mutation(api.mail.disconnect, { channelId })).rejects.toThrow(
      "account could not be found",
    );

    await asUser.mutation(api.mail.disconnect, { channelId });
    const stored = await t.run(async (ctx) => ctx.db.get(connectionId));
    expect(stored).toMatchObject({ status: "disconnected", syncStatus: "idle" });
    expect(stored?.accessTokenEncrypted).toBeUndefined();
    expect(stored?.refreshTokenEncrypted).toBeUndefined();
  });

  test("queues Gmail webhook syncs for the matching active connection and debounces bursts", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const { inboxId, userId, workspaceId } = await createWorkspace(t);
    const { connectionId } = await connectMailbox(t, workspaceId, inboxId, userId);

    await expect(
      t.mutation(internal.mail.queueGmailPushSync, {
        emailAddress: "OWNER@EXAMPLE.COM",
        historyId: "100",
        now: 1_000,
      }),
    ).resolves.toEqual({ matched: 1, scheduled: 1 });
    await expect(
      t.mutation(internal.mail.queueGmailPushSync, {
        emailAddress: "owner@example.com",
        historyId: "101",
        now: 1_001,
      }),
    ).resolves.toEqual({ matched: 1, scheduled: 0 });
    await expect(
      t.mutation(internal.mail.queueGmailPushSync, {
        emailAddress: "other@example.com",
        historyId: "102",
        now: 1_002,
      }),
    ).resolves.toEqual({ matched: 0, scheduled: 0 });

    const connection = await t.run(async (ctx) => ctx.db.get(connectionId));
    expect(connection?.gmailHistoryId).toBe("101");
    expect(connection?.nextAutoSyncAt).toBeGreaterThan(1_001);
  });

  test("fallback scheduling includes connected Gmail mailboxes but not Outlook", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const { inboxId, userId, workspaceId } = await createWorkspace(t);
    const gmail = await connectMailbox(t, workspaceId, inboxId, userId);
    const outlook = await t.mutation(internal.mail.completeOauth, {
      workspaceId,
      inboxId,
      channelId: null,
      userId,
      provider: "outlook",
      providerAccountId: "outlook-account",
      emailAddress: "outlook@example.com",
      accessTokenEncrypted: "encrypted-access-token",
      refreshTokenEncrypted: "encrypted-refresh-token",
      accessTokenExpiresAt: 2_000_000_000_000,
      scope: "Mail.Read",
    });

    await expect(
      t.mutation(internal.mail.scheduleGmailFallbackSyncs, { now: 5_000 }),
    ).resolves.toBe(1);
    await expect(
      t.mutation(internal.mail.scheduleGmailFallbackSyncs, { now: 5_001 }),
    ).resolves.toBe(0);

    const [gmailConnection, outlookConnection] = await t.run(async (ctx) =>
      Promise.all([ctx.db.get(gmail.connectionId), ctx.db.get(outlook.connectionId)]),
    );
    expect(gmailConnection?.nextAutoSyncAt).toBeGreaterThan(5_000);
    expect(outlookConnection?.nextAutoSyncAt).toBeUndefined();
  });

  test("prevents concurrent mailbox syncs while allowing stale claims to recover", async () => {
    const t = convexTest(schema, modules);
    const { inboxId, userId, workspaceId } = await createWorkspace(t);
    const { connectionId } = await connectMailbox(t, workspaceId, inboxId, userId);

    await expect(
      t.mutation(internal.mail.markSyncStarted, { connectionId, now: 1_000 }),
    ).resolves.toBe(true);
    await expect(
      t.mutation(internal.mail.markSyncStarted, { connectionId, now: 1_001 }),
    ).resolves.toBe(false);
    await expect(
      t.mutation(internal.mail.markSyncStarted, { connectionId, now: 700_001 }),
    ).resolves.toBe(true);
  });

  test("schedules missing and expiring Gmail watches for renewal", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const { inboxId, userId, workspaceId } = await createWorkspace(t);
    const { connectionId } = await connectMailbox(t, workspaceId, inboxId, userId);

    await expect(
      t.mutation(internal.mail.scheduleGmailWatchRenewals, { now: 10_000 }),
    ).resolves.toBe(1);

    await t.mutation(internal.mail.recordGmailWatch, {
      connectionId,
      historyId: "200",
      expirationAt: 100_000_000,
    });
    await expect(
      t.mutation(internal.mail.scheduleGmailWatchRenewals, { now: 10_000 }),
    ).resolves.toBe(0);
    await expect(
      t.mutation(internal.mail.scheduleGmailWatchRenewals, { now: 20_000_000 }),
    ).resolves.toBe(1);
  });
});

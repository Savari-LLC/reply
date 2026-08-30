/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob([
  "./**/*.{ts,js}",
  "!./**/*.test.ts",
]);

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
  return t.withIdentity({ subject: userId });
}

describe("demo test API", () => {
  beforeEach(() => {
    process.env.ALLOW_DEMO_TEST_PAGE = "true";
  });

  afterEach(() => {
    delete process.env.ALLOW_DEMO_TEST_PAGE;
  });

  test("rejects every call when the flag is not set", async () => {
    delete process.env.ALLOW_DEMO_TEST_PAGE;
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.demo.ensureSeeded, {})).rejects.toThrow(
      /disabled/,
    );
    await expect(t.query(api.demo.listInboxes, {})).rejects.toThrow(/disabled/);
    await expect(t.query(api.demo.listThreads, {})).rejects.toThrow(/disabled/);
    await expect(t.query(api.demo.listTeammates, {})).rejects.toThrow(
      /disabled/,
    );
  });

  test("rejects unauthenticated callers", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.demo.ensureSeeded, {})).rejects.toThrow(
      /Sign in/,
    );
    await expect(t.query(api.demo.listInboxes, {})).rejects.toThrow(/Sign in/);
    await expect(t.query(api.demo.listThreads, {})).rejects.toThrow(/Sign in/);
    await expect(t.query(api.demo.listTeammates, {})).rejects.toThrow(
      /Sign in/,
    );
    await expect(
      t.query(api.demo.getThread, { threadId: "whatever" }),
    ).rejects.toThrow(/Sign in/);
  });

  test("rejects callers with an identity that has no user record", async () => {
    const t = convexTest(schema, modules);
    const ghost = t.withIdentity({ subject: "not-a-user-id" });
    await expect(ghost.query(api.demo.listInboxes, {})).rejects.toThrow(
      /Sign in/,
    );
  });

  test("returns null before seeding and lists inboxes after", async () => {
    const t = convexTest(schema, modules);
    const asUser = await signUp(t, "romi");
    expect(await asUser.query(api.demo.listInboxes, {})).toBeNull();
    await asUser.mutation(api.demo.ensureSeeded, {});
    const inboxes = await asUser.query(api.demo.listInboxes, {});
    expect(inboxes?.map((inbox) => inbox.name).sort()).toEqual([
      "Accounts",
      "Sales",
      "Support",
    ]);
  });

  test("a signed-in user who has not joined sees null until they join", async () => {
    const t = convexTest(schema, modules);
    const asFirst = await signUp(t, "first");
    await asFirst.mutation(api.demo.ensureSeeded, {});

    const asSecond = await signUp(t, "second");
    expect(await asSecond.query(api.demo.listInboxes, {})).toBeNull();
    expect(await asSecond.query(api.demo.listThreads, {})).toBeNull();

    await asSecond.mutation(api.demo.ensureSeeded, {});
    const inboxes = await asSecond.query(api.demo.listInboxes, {});
    expect(inboxes).not.toBeNull();
  });

  test("joining copies the seed read state so the unread story matches", async () => {
    const t = convexTest(schema, modules);
    const asUser = await signUp(t, "romi");
    await asUser.mutation(api.demo.ensureSeeded, {});
    const threads = await asUser.query(api.demo.listThreads, {});
    const northstar = threads?.find(
      (thread) => thread.subject === "Quote for GCC-wide delivery coverage",
    );
    const priced = threads?.find(
      (thread) => thread.subject === "Pricing for 8-seat installer team",
    );
    expect(northstar?.unread).toBe(true);
    expect(priced?.unread).toBe(false);
  });

  test("teammates include the signed-in user after joining", async () => {
    const t = convexTest(schema, modules);
    const asUser = await signUp(t, "romi");
    await asUser.mutation(api.demo.ensureSeeded, {});
    const teammates = await asUser.query(api.demo.listTeammates, {});
    expect(teammates?.map((teammate) => teammate.name)).toContain("romi");
  });

  test("unread state is tracked per user", async () => {
    const t = convexTest(schema, modules);
    const asNoah = await signUp(t, "noah-real");
    const asMaya = await signUp(t, "maya-real");
    await asNoah.mutation(api.demo.ensureSeeded, {});
    await asMaya.mutation(api.demo.ensureSeeded, {});
    const { northstarThreadId: threadId } = await t.mutation(
      internal.seed.run,
      {},
    );

    const before = await asNoah.query(api.demo.getThread, { threadId });
    expect(before?.unread).toBe(true);

    await asNoah.mutation(api.demo.markRead, { threadId });

    const noahView = await asNoah.query(api.demo.getThread, { threadId });
    const mayaView = await asMaya.query(api.demo.getThread, { threadId });
    expect(noahView?.unread).toBe(false);
    expect(mayaView?.unread).toBe(true);
  });

  test("a read thread becomes unread again after a newer message", async () => {
    const t = convexTest(schema, modules);
    const asUser = await signUp(t, "romi");
    await asUser.mutation(api.demo.ensureSeeded, {});
    const { northstarThreadId } = await t.mutation(internal.seed.run, {});

    await asUser.mutation(api.demo.markRead, { threadId: northstarThreadId });
    await t.run(async (ctx) => {
      const thread = await ctx.db.get(northstarThreadId);
      if (!thread) throw new Error("missing thread");
      const sentAt = Date.now() + 60_000;
      await ctx.db.insert("messages", {
        workspaceId: thread.workspaceId,
        threadId: thread._id,
        direction: "inbound",
        senderName: thread.senderName,
        senderEmail: thread.senderEmail,
        body: "Any update on the quote?",
        sentAt,
      });
      await ctx.db.patch(thread._id, { lastMessageAt: sentAt });
    });

    const after = await asUser.query(api.demo.getThread, {
      threadId: northstarThreadId,
    });
    expect(after?.unread).toBe(true);
  });

  test("sendReply records the signed-in user as author and marks read", async () => {
    const t = convexTest(schema, modules);
    const asLeila = await signUp(t, "Leila Real");
    const asMaya = await signUp(t, "maya-real");
    await asLeila.mutation(api.demo.ensureSeeded, {});
    await asMaya.mutation(api.demo.ensureSeeded, {});
    const { northstarThreadId } = await t.mutation(internal.seed.run, {});

    await asLeila.mutation(api.demo.sendReply, {
      threadId: northstarThreadId,
      body: "Thanks Rania — quote attached.",
    });

    const leilaView = await asLeila.query(api.demo.getThread, {
      threadId: northstarThreadId,
    });
    expect(leilaView?.status).toBe("waiting");
    expect(leilaView?.unread).toBe(false);
    const lastMessage = leilaView?.messages[leilaView.messages.length - 1];
    expect(lastMessage?.direction).toBe("outbound");
    expect(lastMessage?.author).toBe("Leila Real");

    const mayaView = await asMaya.query(api.demo.getThread, {
      threadId: northstarThreadId,
    });
    expect(mayaView?.unread).toBe(true);
  });

  test("mutations refuse users who have not joined the workspace", async () => {
    const t = convexTest(schema, modules);
    const asMember = await signUp(t, "member");
    await asMember.mutation(api.demo.ensureSeeded, {});
    const { northstarThreadId } = await t.mutation(internal.seed.run, {});

    const asOutsider = await signUp(t, "outsider");
    await expect(
      asOutsider.mutation(api.demo.sendReply, {
        threadId: northstarThreadId,
        body: "I should not be able to post this",
      }),
    ).rejects.toThrow(/not a member/);
    await expect(
      asOutsider.mutation(api.demo.setStatus, {
        threadId: northstarThreadId,
        status: "closed",
      }),
    ).rejects.toThrow(/not a member/);
    await expect(
      asOutsider.mutation(api.demo.markRead, {
        threadId: northstarThreadId,
      }),
    ).rejects.toThrow(/not a member/);
  });

  test("rejects empty replies and cross-checks assignment membership", async () => {
    const t = convexTest(schema, modules);
    const asUser = await signUp(t, "romi");
    await asUser.mutation(api.demo.ensureSeeded, {});
    const { northstarThreadId } = await t.mutation(internal.seed.run, {});

    await expect(
      asUser.mutation(api.demo.sendReply, {
        threadId: northstarThreadId,
        body: "   ",
      }),
    ).rejects.toThrow(/cannot be empty/);

    const outsiderId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        authProvider: "password",
        providerAccountId: "test|assignee-outsider",
        username: "assignee-outsider",
        name: "Outsider",
      }),
    );
    await expect(
      asUser.mutation(api.demo.assign, {
        threadId: northstarThreadId,
        teammateId: outsiderId,
      }),
    ).rejects.toThrow(/not in the demo workspace/);
  });

  test("invalid ids return null instead of throwing", async () => {
    const t = convexTest(schema, modules);
    const asUser = await signUp(t, "romi");
    await asUser.mutation(api.demo.ensureSeeded, {});
    expect(
      await asUser.query(api.demo.getThread, { threadId: "not-a-real-id" }),
    ).toBeNull();
    expect(
      await asUser.query(api.demo.listThreads, { inboxId: "not-a-real-id" }),
    ).toBeNull();
  });
});

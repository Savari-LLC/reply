/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob([
  "./**/*.{ts,js}",
  "!./**/*.test.ts",
]);

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

  test("returns null before seeding and lists inboxes after", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.demo.listInboxes, {})).toBeNull();
    await t.mutation(api.demo.ensureSeeded, {});
    const inboxes = await t.query(api.demo.listInboxes, {});
    expect(inboxes?.map((inbox) => inbox.name).sort()).toEqual([
      "Accounts",
      "Sales",
      "Support",
    ]);
  });

  test("rejects an unknown actor", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.demo.ensureSeeded, {});
    await expect(
      t.query(api.demo.listThreads, { actor: "intruder" }),
    ).rejects.toThrow(/Unknown demo actor/);
  });

  test("unread state is tracked per actor", async () => {
    const t = convexTest(schema, modules);
    const { workspaceId } = await t.mutation(api.demo.ensureSeeded, {});
    const seedResult = await t.mutation(internal.seed.run, {});
    expect(seedResult.workspaceId).toBe(workspaceId);
    const threadId = seedResult.northstarThreadId;

    const before = await t.query(api.demo.getThread, {
      threadId,
      actor: "noah",
    });
    expect(before?.unread).toBe(true);

    await t.mutation(api.demo.markRead, { threadId, actor: "noah" });

    const asNoah = await t.query(api.demo.getThread, {
      threadId,
      actor: "noah",
    });
    const asMaya = await t.query(api.demo.getThread, {
      threadId,
      actor: "maya",
    });
    expect(asNoah?.unread).toBe(false);
    expect(asMaya?.unread).toBe(true);
  });

  test("a read thread becomes unread again after a newer message", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.demo.ensureSeeded, {});
    const { northstarThreadId } = await t.mutation(internal.seed.run, {});

    await t.mutation(api.demo.markRead, {
      threadId: northstarThreadId,
      actor: "maya",
    });
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

    const after = await t.query(api.demo.getThread, {
      threadId: northstarThreadId,
      actor: "maya",
    });
    expect(after?.unread).toBe(true);
  });

  test("sendReply records the acting teammate as author and marks read", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.demo.ensureSeeded, {});
    const { northstarThreadId } = await t.mutation(internal.seed.run, {});

    await t.mutation(api.demo.sendReply, {
      threadId: northstarThreadId,
      body: "Thanks Rania — quote attached.",
      actor: "leila",
    });

    const asLeila = await t.query(api.demo.getThread, {
      threadId: northstarThreadId,
      actor: "leila",
    });
    expect(asLeila?.status).toBe("waiting");
    expect(asLeila?.unread).toBe(false);
    const lastMessage = asLeila?.messages[asLeila.messages.length - 1];
    expect(lastMessage?.direction).toBe("outbound");
    expect(lastMessage?.author).toBe("Leila Mansour");

    const asMaya = await t.query(api.demo.getThread, {
      threadId: northstarThreadId,
      actor: "maya",
    });
    expect(asMaya?.unread).toBe(true);
  });

  test("rejects empty replies and cross-checks assignment membership", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.demo.ensureSeeded, {});
    const { northstarThreadId } = await t.mutation(internal.seed.run, {});

    await expect(
      t.mutation(api.demo.sendReply, {
        threadId: northstarThreadId,
        body: "   ",
      }),
    ).rejects.toThrow(/cannot be empty/);

    const outsiderId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        tokenIdentifier: "seed|outsider",
        username: "outsider",
        name: "Outsider",
      }),
    );
    await expect(
      t.mutation(api.demo.assign, {
        threadId: northstarThreadId,
        teammateId: outsiderId,
      }),
    ).rejects.toThrow(/not in the demo workspace/);
  });

  test("invalid ids return null instead of throwing", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.demo.ensureSeeded, {});
    expect(
      await t.query(api.demo.getThread, { threadId: "not-a-real-id" }),
    ).toBeNull();
    expect(
      await t.query(api.demo.listThreads, { inboxId: "not-a-real-id" }),
    ).toBeNull();
  });
});

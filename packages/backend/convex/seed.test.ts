/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob([
  "./**/*.{ts,js}",
  "!./**/*.test.ts",
]);

describe("seed:run", () => {
  test("seeds the demo workspace with inboxes, threads, and messages", async () => {
    const t = convexTest(schema, modules);
    const result = await t.mutation(internal.seed.run, {});

    expect(result.seeded).toBe(true);
    expect(result.threadCount).toBeGreaterThanOrEqual(20);
    expect(result.messageCount).toBeGreaterThan(result.threadCount);

    await t.run(async (ctx) => {
      const inboxes = await ctx.db.query("inboxes").collect();
      expect(inboxes.map((inbox) => inbox.name).sort()).toEqual([
        "Accounts",
        "Sales",
        "Support",
      ]);

      const northstar = await ctx.db.get(result.northstarThreadId);
      expect(northstar).not.toBeNull();
      expect(northstar?.priority).toBe("urgent");
      expect(northstar?.status).toBe("open");
      expect(northstar?.senderDomain).toBe("northstar.ae");

      // Northstar is the most recent thread in the workspace.
      const [latest] = await ctx.db
        .query("threads")
        .withIndex("by_workspaceId_and_lastMessageAt", (q) =>
          q.eq("workspaceId", result.workspaceId),
        )
        .order("desc")
        .take(1);
      expect(latest._id).toBe(result.northstarThreadId);

      // Northstar is unread: no threadReads rows for it.
      const reads = await ctx.db
        .query("threadReads")
        .withIndex("by_threadId", (q) =>
          q.eq("threadId", result.northstarThreadId),
        )
        .collect();
      expect(reads).toHaveLength(0);

      // Every thread has at least one message with matching workspace.
      const threads = await ctx.db.query("threads").collect();
      for (const thread of threads) {
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_threadId_and_sentAt", (q) =>
            q.eq("threadId", thread._id),
          )
          .collect();
        expect(messages.length).toBeGreaterThan(0);
        for (const message of messages) {
          expect(message.workspaceId).toBe(thread.workspaceId);
          expect(message.sentAt).toBeLessThanOrEqual(thread.lastMessageAt);
        }
      }
    });
  });

  test("re-running without force is a no-op", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(internal.seed.run, {});
    const second = await t.mutation(internal.seed.run, {});

    expect(second.seeded).toBe(false);
    expect(second.workspaceId).toBe(first.workspaceId);
    expect(second.northstarThreadId).toBe(first.northstarThreadId);
    expect(second.threadCount).toBe(first.threadCount);
    expect(second.messageCount).toBe(first.messageCount);

    await t.run(async (ctx) => {
      const workspaces = await ctx.db.query("workspaces").collect();
      expect(workspaces).toHaveLength(1);
      const threads = await ctx.db.query("threads").collect();
      expect(threads).toHaveLength(first.threadCount);
    });
  });

  test("force wipes and reseeds cleanly", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(internal.seed.run, {});
    const reseeded = await t.mutation(internal.seed.run, { force: true });

    expect(reseeded.seeded).toBe(true);
    expect(reseeded.workspaceId).not.toBe(first.workspaceId);

    await t.run(async (ctx) => {
      const workspaces = await ctx.db.query("workspaces").collect();
      expect(workspaces).toHaveLength(1);
      const threads = await ctx.db.query("threads").collect();
      expect(threads).toHaveLength(reseeded.threadCount);
      const messages = await ctx.db.query("messages").collect();
      expect(messages).toHaveLength(reseeded.messageCount);
      const users = await ctx.db.query("users").collect();
      expect(users).toHaveLength(4);
    });
  });

  test("force refuses to clear a workspace not created by the seed", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("workspaces", {
        name: "Real workspace",
        slug: "reply-demo",
      });
    });
    await expect(
      t.mutation(internal.seed.run, { force: true }),
    ).rejects.toThrow(/not created by the demo seed/);
  });
});

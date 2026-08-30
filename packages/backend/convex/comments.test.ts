/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";

import contextDevSchema from "../node_modules/@context-dot-dev/convex/dist/component/schema.js";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.{ts,js}", "!./**/*.test.ts"]);
const contextDevModules = import.meta.glob(
  "../node_modules/@context-dot-dev/convex/dist/component/**/*.js",
);

type T = TestConvex<typeof schema>;

function makeTest(): T {
  const t = convexTest(schema, modules);
  t.registerComponent("contextDev", contextDevSchema, contextDevModules);
  return t;
}

async function setupThread(t: T) {
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      authProvider: "password",
      providerAccountId: "test|romi",
      username: "romi",
      name: "Romi",
    }),
  );
  const asUser = t.withIdentity({ subject: userId });
  await asUser.mutation(api.workspaces.create, { name: "romi workspace" });
  const inboxes = await asUser.query(api.inbox.listInboxes, {});
  const sales = inboxes.find((inbox) => inbox.name === "Sales")!;
  const { threadId } = await asUser.mutation(api.simulate.simulateIncomingEmail, {
    inboxId: sales._id,
  });
  return { asUser, threadId };
}

describe("addComment", () => {
  test("rejects signed-out callers and empty bodies", async () => {
    const t = makeTest();
    const { asUser, threadId } = await setupThread(t);
    await expect(
      t.mutation(api.inbox.addComment, { threadId, body: "hi" }),
    ).rejects.toThrow();
    await expect(
      asUser.mutation(api.inbox.addComment, { threadId, body: "   " }),
    ).rejects.toThrow("Comment body cannot be empty");
  });

  test("posts an internal comment without emailing or moving the thread", async () => {
    const t = makeTest();
    const { asUser, threadId } = await setupThread(t);
    const before = await asUser.query(api.inbox.getThread, { threadId });

    await asUser.mutation(api.inbox.addComment, { threadId, body: "Looping in billing." });

    const detail = await asUser.query(api.inbox.getThread, { threadId });
    expect(detail?.comments).toHaveLength(1);
    expect(detail?.comments[0]).toMatchObject({
      body: "Looping in billing.",
      authorName: "Romi",
    });
    // Comments never become customer-visible messages or change the status.
    expect(detail?.messages).toHaveLength(before!.messages.length);
    expect(detail?.status).toBe(before!.status);
    expect(detail?.lastMessageAt).toBe(before!.lastMessageAt);
  });

  test("records mentions of workspace members and drops outsiders", async () => {
    const t = makeTest();
    const { asUser, threadId } = await setupThread(t);
    const teammates = await asUser.query(api.inbox.listTeammates, {});
    const self = teammates[0]!;
    // A user who exists but is not in this workspace must never be mentionable.
    const outsiderId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        authProvider: "password",
        providerAccountId: "test|outsider",
        username: "outsider",
        name: "Outsider",
      }),
    );

    await asUser.mutation(api.inbox.addComment, {
      threadId,
      body: `@${self.name} can you take this?`,
      mentionedUserIds: [self._id, outsiderId],
    });

    const detail = await asUser.query(api.inbox.getThread, { threadId });
    expect(detail?.comments[0]?.mentions).toEqual([{ userId: self._id, name: self.name }]);
  });

  test("stores attachments and returns signed URLs", async () => {
    const t = makeTest();
    const { asUser, threadId } = await setupThread(t);
    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["hello"], { type: "text/plain" })),
    );

    await asUser.mutation(api.inbox.addComment, {
      threadId,
      body: "",
      attachments: [{ storageId, name: "notes.txt", size: 5, type: "text/plain" }],
    });

    const detail = await asUser.query(api.inbox.getThread, { threadId });
    const attachment = detail?.comments[0]?.attachments[0];
    expect(attachment).toMatchObject({ name: "notes.txt", size: 5, type: "text/plain" });
    expect(attachment?.url).toBeTypeOf("string");
  });

  test("members of another workspace cannot comment on the thread", async () => {
    const t = makeTest();
    const { threadId } = await setupThread(t);
    const intruderId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        authProvider: "password",
        providerAccountId: "test|intruder",
        username: "intruder",
        name: "Intruder",
      }),
    );
    const asIntruder = t.withIdentity({ subject: intruderId });
    await asIntruder.mutation(api.workspaces.create, { name: "intruder workspace" });
    await expect(
      asIntruder.mutation(api.inbox.addComment, { threadId, body: "sneaky" }),
    ).rejects.toThrow("Conversation not found");
  });
});

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

async function setupWorkspaceWithThread(t: T, username = "romi") {
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      authProvider: "password",
      providerAccountId: `test|${username}`,
      username,
      name: username,
    }),
  );
  const asUser = t.withIdentity({ subject: userId });
  await asUser.mutation(api.workspaces.create, { name: `${username} workspace` });
  const inboxes = await asUser.query(api.inbox.listInboxes, {});
  const sales = inboxes.find((inbox) => inbox.name === "Sales")!;
  const { threadId } = await asUser.mutation(api.simulate.simulateIncomingEmail, {
    inboxId: sales._id,
  });
  return { userId, asUser, salesId: sales._id, threadId };
}

describe("setPriority", () => {
  test("marks a thread urgent and back to normal", async () => {
    const t = makeTest();
    const { asUser, threadId } = await setupWorkspaceWithThread(t);

    await asUser.mutation(api.inbox.setPriority, { threadId, priority: "urgent" });
    let detail = await asUser.query(api.inbox.getThread, { threadId });
    expect(detail?.priority).toBe("urgent");

    await asUser.mutation(api.inbox.setPriority, { threadId, priority: "normal" });
    detail = await asUser.query(api.inbox.getThread, { threadId });
    expect(detail?.priority).toBe("normal");
  });

  test("rejects signed-out callers", async () => {
    const t = makeTest();
    const { threadId } = await setupWorkspaceWithThread(t);
    await expect(
      t.mutation(api.inbox.setPriority, { threadId, priority: "urgent" }),
    ).rejects.toThrow();
  });

  test("rejects members of another workspace", async () => {
    const t = makeTest();
    const { threadId } = await setupWorkspaceWithThread(t);

    const intruderId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        authProvider: "password",
        providerAccountId: "test|intruder",
        username: "intruder",
        name: "intruder",
      }),
    );
    const asIntruder = t.withIdentity({ subject: intruderId });
    await asIntruder.mutation(api.workspaces.create, { name: "intruder workspace" });

    await expect(
      asIntruder.mutation(api.inbox.setPriority, { threadId, priority: "urgent" }),
    ).rejects.toThrow();
  });
});

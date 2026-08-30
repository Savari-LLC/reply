/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";

import contextDevSchema from "../node_modules/@context-dot-dev/convex/dist/component/schema.js";
import { api, internal } from "./_generated/api";
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

async function setupWorkspace(t: T, username = "romi") {
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      authProvider: "password",
      providerAccountId: `test|${username}`,
      username,
      name: username,
    }),
  );
  const asUser = t.withIdentity({ subject: userId });
  const workspaceId = await asUser.mutation(api.workspaces.create, {
    name: `${username} workspace`,
  });
  return { userId, asUser, workspaceId };
}

async function seedThread(asUser: ReturnType<T["withIdentity"]>) {
  const inboxes = await asUser.query(api.inbox.listInboxes, {});
  const sales = inboxes.find((inbox) => inbox.name === "Sales")!;
  const { threadId } = await asUser.mutation(api.simulate.simulateIncomingEmail, {
    inboxId: sales._id,
  });
  return threadId;
}

describe("copilot draft context", () => {
  test("rejects signed-out callers", async () => {
    const t = makeTest();
    const { asUser } = await setupWorkspace(t);
    const threadId = await seedThread(asUser);
    await expect(
      t.query(internal.inbox.getDraftContext, { threadId }),
    ).rejects.toThrow();
  });

  test("returns the transcript, sender, agent, and stored company profile", async () => {
    const t = makeTest();
    const { asUser, workspaceId } = await setupWorkspace(t);
    const threadId = await seedThread(asUser);
    await asUser.mutation(api.inbox.sendReply, {
      threadId,
      body: "Thanks for reaching out — checking on this now.",
    });
    const thread = (await t.run(async (ctx) => ctx.db.get(threadId)))!;
    await t.run(async (ctx) => {
      await ctx.db.insert("companyProfiles", {
        workspaceId,
        domain: thread.senderDomain,
        name: "Acme Rockets",
        description: "Rocket-powered logistics.",
        industry: "Logistics & Supply Chain",
        fetchedAt: Date.now(),
      });
    });

    const context = await asUser.query(internal.inbox.getDraftContext, { threadId });
    expect(context).not.toBeNull();
    expect(context!.agentName).toBe("romi");
    expect(context!.workspaceName).toBe("romi workspace");
    expect(context!.subject).toBe(thread.subject);
    expect(context!.senderEmail).toBe(thread.senderEmail);
    expect(context!.company).toMatchObject({
      name: "Acme Rockets",
      description: "Rocket-powered logistics.",
      industry: "Logistics & Supply Chain",
    });
    expect(context!.messages.length).toBeGreaterThanOrEqual(2);
    expect(context!.messages[0]!.direction).toBe("inbound");
    expect(context!.messages[context!.messages.length - 1]).toMatchObject({
      direction: "outbound",
      sender: "romi",
      body: "Thanks for reaching out — checking on this now.",
    });
  });

  test("members of another workspace get null, not data", async () => {
    const t = makeTest();
    const { asUser } = await setupWorkspace(t);
    const threadId = await seedThread(asUser);
    const { asUser: asIntruder } = await setupWorkspace(t, "intruder");
    await expect(
      asIntruder.query(internal.inbox.getDraftContext, { threadId }),
    ).resolves.toBeNull();
  });
});

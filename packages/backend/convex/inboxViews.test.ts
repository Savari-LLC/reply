/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";

import contextDevSchema from "../node_modules/@context-dot-dev/convex/dist/component/schema.js";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
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

async function findInbox(asUser: ReturnType<T["withIdentity"]>, name: string) {
  const inboxes = await asUser.query(api.inbox.listInboxes, {});
  return inboxes.find((inbox) => inbox.name === name)!;
}

async function seedThread(
  asUser: ReturnType<T["withIdentity"]>,
  inboxId: Id<"inboxes">,
) {
  const { threadId } = await asUser.mutation(api.simulate.simulateIncomingEmail, {
    inboxId,
  });
  return threadId;
}

describe("shared inbox views", () => {
  test("open, assigned, and done scope listThreads", async () => {
    const t = makeTest();
    const { asUser, userId } = await setupWorkspace(t);
    const sales = await findInbox(asUser, "Sales");
    const openThread = await seedThread(asUser, sales._id);
    const assignedThread = await seedThread(asUser, sales._id);
    const doneThread = await seedThread(asUser, sales._id);
    await asUser.mutation(api.inbox.assign, {
      threadId: assignedThread,
      teammateId: userId,
    });
    await asUser.mutation(api.inbox.setStatus, {
      threadId: doneThread,
      status: "closed",
    });

    const open = await asUser.query(api.inbox.listThreads, {
      inboxId: sales._id,
      view: "open",
    });
    expect(open!.map((thread) => thread._id).sort()).toEqual(
      [openThread, assignedThread].sort(),
    );

    const assigned = await asUser.query(api.inbox.listThreads, {
      inboxId: sales._id,
      view: "assigned",
    });
    expect(assigned!.map((thread) => thread._id)).toEqual([assignedThread]);

    const done = await asUser.query(api.inbox.listThreads, {
      inboxId: sales._id,
      view: "done",
    });
    expect(done!.map((thread) => thread._id)).toEqual([doneThread]);

    // No view returns everything.
    const all = await asUser.query(api.inbox.listThreads, { inboxId: sales._id });
    expect(all!).toHaveLength(3);
  });

  test("replying keeps a waiting conversation in the open view", async () => {
    const t = makeTest();
    const { asUser } = await setupWorkspace(t);
    const sales = await findInbox(asUser, "Sales");
    const threadId = await seedThread(asUser, sales._id);
    await asUser.mutation(api.inbox.sendReply, { threadId, body: "On it!" });

    const open = await asUser.query(api.inbox.listThreads, {
      inboxId: sales._id,
      view: "open",
    });
    expect(open!.map((thread) => thread._id)).toEqual([threadId]);
    expect(open![0]!.status).toBe("waiting");
  });
});

describe("personal views", () => {
  test("sent lists only conversations the member replied to", async () => {
    const t = makeTest();
    const { asUser } = await setupWorkspace(t);
    const sales = await findInbox(asUser, "Sales");
    const replied = await seedThread(asUser, sales._id);
    await seedThread(asUser, sales._id); // untouched thread

    expect(await asUser.query(api.inbox.listPersonalThreads, { view: "sent" })).toEqual(
      [],
    );
    await asUser.mutation(api.inbox.sendReply, { threadId: replied, body: "Hello!" });
    await asUser.mutation(api.inbox.sendReply, { threadId: replied, body: "Again!" });

    const sent = await asUser.query(api.inbox.listPersonalThreads, { view: "sent" });
    // Two replies on one thread still yield a single row.
    expect(sent.map((thread) => thread._id)).toEqual([replied]);
  });

  test("mentions lists conversations where the member is tagged", async () => {
    const t = makeTest();
    const { asUser, workspaceId } = await setupWorkspace(t);
    const teammateId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authProvider: "password",
        providerAccountId: "test|noor",
        username: "noor",
        name: "noor",
      });
      await ctx.db.insert("memberships", { workspaceId, userId, role: "member" });
      return userId;
    });
    const asTeammate = t.withIdentity({ subject: teammateId });
    const sales = await findInbox(asUser, "Sales");
    await t.run(async (ctx) => {
      await ctx.db.insert("inboxAccess", {
        workspaceId,
        inboxId: sales._id,
        userId: teammateId,
      });
    });
    const threadId = await seedThread(asUser, sales._id);
    await asUser.mutation(api.inbox.addComment, {
      threadId,
      body: "@noor can you take this?",
      mentionedUserIds: [teammateId],
    });

    const mentions = await asTeammate.query(api.inbox.listPersonalThreads, {
      view: "mentions",
    });
    expect(mentions.map((thread) => thread._id)).toEqual([threadId]);
    // The author was not mentioned, so their view stays empty.
    expect(
      await asUser.query(api.inbox.listPersonalThreads, { view: "mentions" }),
    ).toEqual([]);

    // Marking the conversation done drops it out of Mentions.
    await asUser.mutation(api.inbox.setStatus, { threadId, status: "closed" });
    expect(
      await asTeammate.query(api.inbox.listPersonalThreads, { view: "mentions" }),
    ).toEqual([]);
  });

  test("mentions hide threads in inboxes the member cannot access", async () => {
    const t = makeTest();
    const { asUser, workspaceId } = await setupWorkspace(t);
    const teammateId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authProvider: "password",
        providerAccountId: "test|zara",
        username: "zara",
        name: "zara",
      });
      await ctx.db.insert("memberships", { workspaceId, userId, role: "member" });
      return userId;
    });
    const asTeammate = t.withIdentity({ subject: teammateId });
    // Mention the teammate on a thread in the admin's personal inbox.
    const personal = await findInbox(asUser, "Your inbox");
    const threadId = await seedThread(asUser, personal._id);
    await asUser.mutation(api.inbox.addComment, {
      threadId,
      body: "@zara for visibility",
      mentionedUserIds: [teammateId],
    });

    expect(
      await asTeammate.query(api.inbox.listPersonalThreads, { view: "mentions" }),
    ).toEqual([]);
  });
});

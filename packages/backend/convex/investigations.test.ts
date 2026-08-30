/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import contextDevSchema from "../node_modules/@context-dot-dev/convex/dist/component/schema.js";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { mapDevinSession, parsePullRequestNumber } from "./lib/devin";
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

/** Insert an inbound thread + email directly, without scheduling side effects. */
async function insertInboundEmail(t: T, workspaceId: Id<"workspaces">) {
  return await t.run(async (ctx) => {
    const inbox = await ctx.db
      .query("inboxes")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
      .first();
    const channelId = await ctx.db.insert("channels", {
      workspaceId,
      inboxId: inbox!._id,
      provider: "gmail",
      address: "support@reply.demo",
      status: "connected",
    });
    const threadId = await ctx.db.insert("threads", {
      workspaceId,
      channelId,
      subject: "Checkout fails after clicking Pay",
      status: "open",
      priority: "normal",
      senderName: "Omar Farouk",
      senderEmail: "omar@acme.example",
      senderDomain: "acme.example",
      lastMessageAt: Date.now(),
    });
    const emailId = await ctx.db.insert("messages", {
      workspaceId,
      threadId,
      direction: "inbound",
      senderName: "Omar Farouk",
      senderEmail: "omar@acme.example",
      body: "Checkout fails after clicking Pay.",
      sentAt: Date.now(),
    });
    return { threadId, emailId };
  });
}

async function getInvestigations(t: T, threadId: Id<"threads">) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("investigations")
      .withIndex("by_threadId", (q) => q.eq("threadId", threadId))
      .collect(),
  );
}

describe("recordClassification", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("stores the classification on the thread", async () => {
    const t = makeTest();
    const { workspaceId } = await setupWorkspace(t);
    const { threadId, emailId } = await insertInboundEmail(t, workspaceId);

    await t.mutation(internal.investigations.recordClassification, {
      threadId,
      emailId,
      category: "billing",
      confidence: 0.95,
      shortSummary: "Customer asks about a duplicate charge.",
    });

    const thread = await t.run(async (ctx) => ctx.db.get(threadId));
    expect(thread!.classification).toMatchObject({
      category: "billing",
      confidence: 0.95,
      shortSummary: "Customer asks about a duplicate charge.",
    });
    expect(await getInvestigations(t, threadId)).toHaveLength(0);
  });

  test("high-confidence technical emails auto-queue an investigation", async () => {
    const t = makeTest();
    const { workspaceId } = await setupWorkspace(t);
    const { threadId, emailId } = await insertInboundEmail(t, workspaceId);

    await t.mutation(internal.investigations.recordClassification, {
      threadId,
      emailId,
      category: "technical",
      confidence: 0.94,
      shortSummary: "Customer reports that checkout fails after clicking Pay.",
    });

    const investigations = await getInvestigations(t, threadId);
    expect(investigations).toHaveLength(1);
    expect(investigations[0]).toMatchObject({
      status: "queued",
      category: "technical",
      confidence: 0.94,
      emailId,
    });

    // Without a Devin key, the scheduled start fails into a clean state.
    await t.finishAllScheduledFunctions(vi.fn());
    const [failed] = await getInvestigations(t, threadId);
    expect(failed!.status).toBe("failed");
    expect(failed!.error?.code).toBe("not_configured");
  });

  test("low-confidence technical emails never start Devin", async () => {
    const t = makeTest();
    const { workspaceId } = await setupWorkspace(t);
    const { threadId, emailId } = await insertInboundEmail(t, workspaceId);

    await t.mutation(internal.investigations.recordClassification, {
      threadId,
      emailId,
      category: "technical",
      confidence: 0.7,
      shortSummary: "Possibly a software problem with the booking form.",
    });

    const thread = await t.run(async (ctx) => ctx.db.get(threadId));
    expect(thread!.classification?.category).toBe("technical");
    expect(await getInvestigations(t, threadId)).toHaveLength(0);
  });

  test("does not queue a second investigation for the same thread", async () => {
    const t = makeTest();
    const { workspaceId } = await setupWorkspace(t);
    const { threadId, emailId } = await insertInboundEmail(t, workspaceId);

    for (let i = 0; i < 2; i += 1) {
      await t.mutation(internal.investigations.recordClassification, {
        threadId,
        emailId,
        category: "technical",
        confidence: 0.9,
        shortSummary: "Customer reports that checkout fails after clicking Pay.",
      });
    }
    expect(await getInvestigations(t, threadId)).toHaveLength(1);
    await t.finishAllScheduledFunctions(vi.fn());
  });
});

describe("Devin session lifecycle", () => {
  beforeEach(() => {
    process.env.DEVIN_API_KEY = "apk_test_key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.DEVIN_API_KEY;
  });

  test("fails cleanly when no repository is connected", async () => {
    const t = makeTest();
    const { workspaceId } = await setupWorkspace(t);
    const { threadId, emailId } = await insertInboundEmail(t, workspaceId);

    await t.mutation(internal.investigations.recordClassification, {
      threadId,
      emailId,
      category: "technical",
      confidence: 0.9,
      shortSummary: "Customer reports that checkout fails after clicking Pay.",
    });
    await t.finishAllScheduledFunctions(vi.fn());

    const [investigation] = await getInvestigations(t, threadId);
    expect(investigation!.status).toBe("failed");
    expect(investigation!.error?.code).toBe("no_repository");
  });

  test("connecting a repository re-queues no_repository failures and completes via polling", async () => {
    const t = makeTest();
    const { asUser, workspaceId } = await setupWorkspace(t);
    const { threadId, emailId } = await insertInboundEmail(t, workspaceId);

    await t.mutation(internal.investigations.recordClassification, {
      threadId,
      emailId,
      category: "technical",
      confidence: 0.9,
      shortSummary: "Customer reports that checkout fails after clicking Pay.",
    });
    await t.finishAllScheduledFunctions(vi.fn());

    // Stub the Devin API: session creation, then a finished poll.
    vi.stubGlobal("fetch", async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/sessions") && init?.method === "POST") {
        return Response.json({
          session_id: "devin-session-1",
          url: "https://app.devin.ai/sessions/devin-session-1",
        });
      }
      return Response.json({
        session_id: "devin-session-1",
        status: "finished",
        status_enum: "finished",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        structured_output: {
          stage: "completed",
          customer_summary:
            "Customers could not finish checkout because the payment request contained an invalid identifier.",
          impact: "Anyone paying by card since Tuesday.",
          root_cause: "A recent software change sent the wrong identifier to the payment provider.",
          fix_summary: "The checkout now sends the correct identifier.",
          tests_passed: true,
          pull_request_url: "https://github.com/acme/shop/pull/142",
          pull_request_number: 142,
        },
        pull_request: { url: "https://github.com/acme/shop/pull/142" },
      });
    });

    await asUser.mutation(api.investigations.setRepository, {
      repoUrl: "https://github.com/acme/shop",
    });
    // The poller reschedules with a delay; drive it with fake timers.
    vi.useFakeTimers();
    try {
      await t.finishAllScheduledFunctions(vi.runAllTimers);
    } finally {
      vi.useRealTimers();
    }

    const [investigation] = await getInvestigations(t, threadId);
    expect(investigation).toMatchObject({
      status: "completed",
      devinSessionId: "devin-session-1",
      testsPassed: true,
      pullRequestUrl: "https://github.com/acme/shop/pull/142",
      pullRequestNumber: 142,
    });
    expect(investigation!.error).toBeUndefined();
  });

  test("setRepository rejects malformed URLs", async () => {
    const t = makeTest();
    const { asUser } = await setupWorkspace(t);
    await expect(
      asUser.mutation(api.investigations.setRepository, { repoUrl: "not a url" }),
    ).rejects.toThrow(/repository URL/);
  });

  test("retry is refused for members of another workspace", async () => {
    const t = makeTest();
    const { workspaceId } = await setupWorkspace(t);
    const { threadId, emailId } = await insertInboundEmail(t, workspaceId);
    await t.mutation(internal.investigations.recordClassification, {
      threadId,
      emailId,
      category: "technical",
      confidence: 0.9,
      shortSummary: "Customer reports that checkout fails after clicking Pay.",
    });
    await t.finishAllScheduledFunctions(vi.fn());
    const [investigation] = await getInvestigations(t, threadId);

    const { asUser: outsider } = await setupWorkspace(t, "intruder");
    await expect(
      outsider.mutation(api.investigations.retry, {
        investigationId: investigation!._id,
      }),
    ).rejects.toThrow(/not found/);
  });
});

describe("mapDevinSession", () => {
  test("maps working stages onto investigation statuses", () => {
    expect(
      mapDevinSession({
        status_enum: "working",
        structured_output: { stage: "reproducing" },
      }),
    ).toMatchObject({ status: "investigating", outcome: "running" });
    expect(
      mapDevinSession({
        status_enum: "working",
        structured_output: { stage: "creating_pr" },
      }),
    ).toMatchObject({ status: "creating_pr", outcome: "running" });
  });

  test("expired sessions fail", () => {
    expect(mapDevinSession({ status_enum: "expired" }).outcome).toBe("failed");
  });

  test("blocked sessions with a PR finalize as completed", () => {
    const progress = mapDevinSession({
      status_enum: "blocked",
      structured_output: { stage: "creating_pr" },
      pull_request: { url: "https://github.com/acme/shop/pull/7" },
    });
    expect(progress).toMatchObject({
      outcome: "completed",
      status: "completed",
      pullRequestUrl: "https://github.com/acme/shop/pull/7",
      pullRequestNumber: 7,
    });
  });

  test("blocked sessions with verified findings but no PR complete as fix-ready", () => {
    const progress = mapDevinSession({
      status_enum: "blocked",
      structured_output: {
        stage: "testing",
        root_cause: "The checkout sent the cart id instead of the payment token.",
        fix_summary: "Checkout now sends the issued payment token.",
        tests_passed: true,
      },
    });
    expect(progress).toMatchObject({
      outcome: "completed",
      status: "completed",
      testsPassed: true,
    });
  });

  test("no_issue_found completes with the flag set", () => {
    const progress = mapDevinSession({
      status_enum: "working",
      structured_output: {
        stage: "no_issue_found",
        customer_summary: "No clear software issue was found.",
      },
    });
    expect(progress).toMatchObject({
      outcome: "completed",
      status: "completed",
      noIssueFound: true,
    });
  });

  test("parsePullRequestNumber reads GitHub and GitLab URLs", () => {
    expect(parsePullRequestNumber("https://github.com/a/b/pull/142")).toBe(142);
    expect(parsePullRequestNumber("https://gitlab.com/a/b/-/merge_requests/9")).toBe(9);
    expect(parsePullRequestNumber(undefined)).toBeUndefined();
  });
});

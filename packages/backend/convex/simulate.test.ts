/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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

function stubBrandFetch(domain: string) {
  vi.stubGlobal("fetch", async (input: URL | RequestInfo) => {
    const url = new URL(String(input));
    if (url.searchParams.get("domain") !== domain) {
      return Response.json({ message: "Unexpected domain" }, { status: 400 });
    }
    return Response.json({
      status: "ok",
      code: 200,
      brand: {
        domain,
        title: "Acme Rockets",
        description: "Rocket-powered logistics.",
        slogan: "Deliveries at escape velocity.",
        colors: [{ hex: "#ff2200", name: "Rocket Red" }],
        logos: [
          {
            url: "https://cdn.example.com/acme-logo.svg",
            mode: "light",
            type: "logo",
            colors: [],
            resolution: { width: 150, height: 48, aspect_ratio: 3.125 },
          },
        ],
        socials: [{ type: "linkedin", url: "https://linkedin.com/company/acme" }],
        address: { city: "Dubai", country: "United Arab Emirates" },
        industries: {
          eic: [{ industry: "Logistics & Supply Chain", subindustry: "Last-Mile Delivery" }],
        },
        email: "hello@acme.example",
        is_nsfw: false,
      },
    });
  });
}

describe("simulateIncomingEmail", () => {
  beforeEach(() => {
    process.env.CONTEXT_DEV_API_KEY = "context_test_key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.CONTEXT_DEV_API_KEY;
  });

  test("rejects signed-out callers", async () => {
    const t = makeTest();
    const { asUser } = await setupWorkspace(t);
    const inboxes = await asUser.query(api.inbox.listInboxes, {});
    await expect(
      t.mutation(api.simulate.simulateIncomingEmail, { inboxId: inboxes[0]!._id }),
    ).rejects.toThrow();
  });

  test("delivers an unread inbound thread and enriches the sender company", async () => {
    const t = makeTest();
    const { asUser, workspaceId } = await setupWorkspace(t);
    const inboxes = await asUser.query(api.inbox.listInboxes, {});
    const sales = inboxes.find((inbox) => inbox.name === "Sales")!;

    const { threadId } = await asUser.mutation(api.simulate.simulateIncomingEmail, {
      inboxId: sales._id,
    });

    const threads = await asUser.query(api.inbox.listThreads, { inboxId: sales._id });
    const thread = threads!.find((row) => row._id === threadId)!;
    expect(thread.unread).toBe(true);
    expect(thread.senderDomain).toContain(".");
    expect(thread.company).toBeNull();

    // Run the scheduled Context.dev enrichment against a stubbed API.
    stubBrandFetch(thread.senderDomain);
    await t.finishAllScheduledFunctions(vi.fn());

    const profile = await t.run(async (ctx) =>
      ctx.db
        .query("companyProfiles")
        .withIndex("by_workspaceId_and_domain", (q) =>
          q.eq("workspaceId", workspaceId).eq("domain", thread.senderDomain),
        )
        .unique(),
    );
    expect(profile?.name).toBe("Acme Rockets");
    expect(profile?.logoUrl).toBe("https://cdn.example.com/acme-logo.svg");
    expect(profile?.location).toBe("Dubai, United Arab Emirates");
    expect(profile?.industry).toBe("Logistics & Supply Chain · Last-Mile Delivery");

    // Thread queries now surface the stored profile for logo avatars.
    const enriched = await asUser.query(api.inbox.listThreads, { inboxId: sales._id });
    expect(enriched!.find((row) => row._id === threadId)!.company).toEqual({
      name: "Acme Rockets",
      logoUrl: "https://cdn.example.com/acme-logo.svg",
    });
    const detail = await asUser.query(api.inbox.getThread, { threadId });
    expect(detail?.companyProfile?.slogan).toBe("Deliveries at escape velocity.");
    expect(detail?.companyProfile?.socials).toEqual([
      { type: "linkedin", url: "https://linkedin.com/company/acme" },
    ]);
  });

  test("members cannot simulate into another member's personal inbox", async () => {
    const t = makeTest();
    const { asUser } = await setupWorkspace(t);
    const inboxes = await asUser.query(api.inbox.listInboxes, {});
    const personal = inboxes.find((inbox) => inbox.kind === "personal")!;

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
      asIntruder.mutation(api.simulate.simulateIncomingEmail, { inboxId: personal._id }),
    ).rejects.toThrow("Inbox not found");
  });

  test("enrichThread skips unresolvable demo domains without calling Context.dev", async () => {
    const t = makeTest();
    const { asUser } = await setupWorkspace(t);
    vi.stubGlobal("fetch", async () => {
      throw new Error("Context.dev must not be called for .test domains");
    });

    const inboxes = await asUser.query(api.inbox.listInboxes, {});
    const sales = inboxes.find((inbox) => inbox.name === "Sales")!;
    const { threadId } = await asUser.mutation(api.simulate.simulateIncomingEmail, {
      inboxId: sales._id,
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(threadId, {
        senderEmail: "operator@demo.test",
        senderDomain: "demo.test",
      });
    });

    await expect(
      asUser.action(api.companyContext.enrichThread, { threadId }),
    ).resolves.toBeNull();
  });
});

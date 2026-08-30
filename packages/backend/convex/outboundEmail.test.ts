/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";

import { api, internal } from "./_generated/api";
import { normalizeOutboundMessage } from "./outboundEmail";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.{ts,js}", "!./**/*.test.ts"]);
type T = TestConvex<typeof schema>;

const validMessage = {
  to: ["customer@example.com"],
  cc: [],
  bcc: [],
  subject: "Project update",
  text: "Hello from Reply",
  html: "<p>Hello from Reply</p>",
};

async function setupWorkspace(t: T) {
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      authProvider: "password",
      providerAccountId: "test|sender",
      username: "sender",
      name: "Sender",
    }),
  );
  const asUser = t.withIdentity({ subject: userId });
  const workspaceId = await asUser.mutation(api.workspaces.create, { name: "Sender workspace" });
  return { asUser, workspaceId };
}

describe("outbound email", () => {
  test("normalizes recipients and removes duplicates across address fields", () => {
    expect(
      normalizeOutboundMessage({
        ...validMessage,
        to: [" Customer@Example.com ", "customer@example.com"],
        cc: ["copy@example.com", "CUSTOMER@example.com"],
        bcc: ["hidden@example.com", "copy@example.com"],
        subject: "  Project update  ",
        text: "  Hello from Reply  ",
      }),
    ).toEqual({
      ...validMessage,
      to: ["customer@example.com"],
      cc: ["copy@example.com"],
      bcc: ["hidden@example.com"],
    });
  });

  test("rejects malformed or incomplete messages before queueing", () => {
    expect(() => normalizeOutboundMessage({ ...validMessage, to: [] })).toThrow(
      "Add at least one recipient",
    );
    expect(() =>
      normalizeOutboundMessage({ ...validMessage, to: ["not-an-email"] }),
    ).toThrow("valid email address");
    expect(() => normalizeOutboundMessage({ ...validMessage, subject: "  " })).toThrow(
      "Add a subject",
    );
    expect(() => normalizeOutboundMessage({ ...validMessage, text: "  " })).toThrow(
      "Message body cannot be empty",
    );
  });

  test("requires authentication before any outbound email work", async () => {
    const t = convexTest(schema, modules);
    await expect(t.action(api.outboundEmail.send, validMessage)).rejects.toThrow(
      "Sign in to continue",
    );
  });

  test("rejects authenticated users without a workspace before queueing", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        authProvider: "password",
        providerAccountId: "test|outsider",
        username: "outsider",
      }),
    );

    await expect(
      t.withIdentity({ subject: userId }).action(api.outboundEmail.send, validMessage),
    ).rejects.toThrow("Join a workspace");
  });

  test("derives the workspace from the authenticated user", async () => {
    const t = convexTest(schema, modules);
    const { asUser, workspaceId } = await setupWorkspace(t);

    await expect(asUser.query(internal.outboundEmail.getSendContext, {})).resolves.toEqual({
      workspaceId,
    });
    await expect(t.query(internal.outboundEmail.getSendContext, {})).rejects.toThrow(
      "account could not be found",
    );
  });
});

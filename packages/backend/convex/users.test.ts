/// <reference types="vite/client" />

import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.{ts,js}", "!./**/*.test.ts"]);

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
  return { userId, asUser: t.withIdentity({ subject: userId }) };
}

async function storeAvatar(t: T) {
  return await t.run(async (ctx) => ctx.storage.store(new Blob(["png"])));
}

describe("profile", () => {
  test("signed-out callers get no profile", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.users.getProfile, {})).toBeNull();
  });

  test("renaming updates the profile the UI reads", async () => {
    const t = convexTest(schema, modules);
    const { asUser } = await signUp(t, "romi");
    await asUser.mutation(api.users.updateProfile, { name: "  Romi Singh  " });
    const profile = await asUser.query(api.users.getProfile, {});
    expect(profile?.name).toBe("Romi Singh");
    expect(profile?.imageUrl).toBeNull();
    expect(profile?.hasUploadedImage).toBe(false);
  });

  test("blank and overlong names are rejected", async () => {
    const t = convexTest(schema, modules);
    const { asUser } = await signUp(t, "romi");
    await expect(asUser.mutation(api.users.updateProfile, { name: "   " })).rejects.toThrow(
      "Enter your name",
    );
    await expect(
      asUser.mutation(api.users.updateProfile, { name: "a".repeat(61) }),
    ).rejects.toThrow("at most 60 characters");
  });

  test("an uploaded avatar is resolved into a URL", async () => {
    const t = convexTest(schema, modules);
    const { asUser } = await signUp(t, "romi");
    const storageId = await storeAvatar(t);
    await asUser.mutation(api.users.updateProfile, { name: "Romi", imageStorageId: storageId });
    const profile = await asUser.query(api.users.getProfile, {});
    expect(profile?.hasUploadedImage).toBe(true);
    expect(profile?.imageUrl).toBeTypeOf("string");
  });

  test("replacing an avatar deletes the previous file", async () => {
    const t = convexTest(schema, modules);
    const { asUser } = await signUp(t, "romi");
    const first = await storeAvatar(t);
    const second = await storeAvatar(t);
    await asUser.mutation(api.users.updateProfile, { name: "Romi", imageStorageId: first });
    await asUser.mutation(api.users.updateProfile, { name: "Romi", imageStorageId: second });
    expect(await t.run(async (ctx) => ctx.db.system.get(first))).toBeNull();
    expect(await t.run(async (ctx) => ctx.db.system.get(second))).not.toBeNull();
  });

  test("clearing an avatar falls back to initials", async () => {
    const t = convexTest(schema, modules);
    const { asUser } = await signUp(t, "romi");
    const storageId = await storeAvatar(t);
    await asUser.mutation(api.users.updateProfile, { name: "Romi", imageStorageId: storageId });
    await asUser.mutation(api.users.updateProfile, { name: "Romi", imageStorageId: null });
    const profile = await asUser.query(api.users.getProfile, {});
    expect(profile?.imageUrl).toBeNull();
    expect(profile?.hasUploadedImage).toBe(false);
  });

  test("omitting imageStorageId keeps the current avatar", async () => {
    const t = convexTest(schema, modules);
    const { asUser } = await signUp(t, "romi");
    const storageId = await storeAvatar(t);
    await asUser.mutation(api.users.updateProfile, { name: "Romi", imageStorageId: storageId });
    await asUser.mutation(api.users.updateProfile, { name: "Romi Singh" });
    const profile = await asUser.query(api.users.getProfile, {});
    expect(profile?.name).toBe("Romi Singh");
    expect(profile?.hasUploadedImage).toBe(true);
  });

  test("signed-out callers cannot edit a profile or get an upload URL", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.users.updateProfile, { name: "Anon" })).rejects.toThrow();
    await expect(t.mutation(api.users.generateAvatarUploadUrl, {})).rejects.toThrow();
  });
});

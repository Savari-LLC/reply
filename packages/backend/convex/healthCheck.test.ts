/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob([
  "./**/*.{ts,js}",
  "!./**/*.test.ts",
]);

describe("starter backend", () => {
  test("responds to the health check without a product schema", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.healthCheck.get, {})).resolves.toBe("OK");
  });
});

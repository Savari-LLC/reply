/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import contextDevSchema from "../node_modules/@context-dot-dev/convex/dist/component/schema.js";
import schema from "./schema";

const modules = import.meta.glob([
  "./**/*.{ts,js}",
  "!./**/*.test.ts",
]);
const contextDevModules = import.meta.glob(
  "../node_modules/@context-dot-dev/convex/dist/component/**/*.js",
);

function registerContextDev(t: ReturnType<typeof convexTest>) {
  t.registerComponent("contextDev", contextDevSchema, contextDevModules);
}

type CompanyPreview = {
  description: string | null;
  domain: string;
  logoUrl: string | null;
  name: string | null;
  primaryColor: string | null;
};

const retrieveCompany = makeFunctionReference<
  "action",
  { domain: string },
  CompanyPreview | null
>("contextPreview:retrieveCompany");

describe("Context.dev preview action", () => {
  beforeEach(() => {
    process.env.CONTEXT_DEV_API_KEY = "context_test_key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.CONTEXT_DEV_API_KEY;
  });

  test("rejects unauthenticated calls before requesting paid context", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("Context.dev should not be called while signed out");
    });

    const t = convexTest(schema, modules);
    registerContextDev(t);

    await expect(
      t.action(retrieveCompany, { domain: "stripe.com" }),
    ).rejects.toThrow("Sign in before requesting company context");
  });

  test("returns a normalized company preview through the Context.dev component", async () => {
    vi.stubGlobal("fetch", async (input: URL | RequestInfo) => {
      const url = new URL(String(input));

      if (url.searchParams.get("domain") !== "stripe.com") {
        return Response.json(
          { message: "Expected the requested company domain" },
          { status: 400 },
        );
      }

      return Response.json({
        status: "ok",
        code: 200,
        brand: {
          domain: "stripe.com",
          title: "Stripe",
          description: "Financial infrastructure for the internet.",
          slogan: "Financial infrastructure to grow your revenue.",
          colors: [
            { hex: "#635BFF", name: "Blurple" },
            { hex: "#0A2540", name: "Midnight" },
          ],
          logos: [
            {
              url: "https://cdn.example.com/stripe-icon.svg",
              mode: "dark",
              type: "icon",
              colors: [{ hex: "#FFFFFF", name: "White" }],
              resolution: { width: 48, height: 48, aspect_ratio: 1 },
            },
            {
              url: "https://cdn.example.com/stripe-logo.svg",
              mode: "light",
              type: "logo",
              colors: [{ hex: "#635BFF", name: "Blurple" }],
              resolution: { width: 150, height: 48, aspect_ratio: 3.125 },
            },
          ],
          backdrops: [],
          socials: [],
          address: {
            street: "354 Oyster Point Boulevard",
            city: "South San Francisco",
            state_province: "California",
            state_code: "CA",
            country: "United States",
            country_code: "US",
            postal_code: "94080",
          },
          stock: null,
          is_nsfw: false,
          email: "support@stripe.com",
          phone: null,
          industries: {
            eic: [{ industry: "Finance", subindustry: "Payments" }],
          },
          links: {
            careers: "https://stripe.com/jobs",
            privacy: "https://stripe.com/privacy",
            terms: "https://stripe.com/legal",
            contact: "https://stripe.com/contact",
            blog: "https://stripe.com/blog",
            pricing: "https://stripe.com/pricing",
          },
          primary_language: "en",
        },
      });
    });

    const t = convexTest(schema, modules);
    registerContextDev(t);

    const result = await t
      .withIdentity({ subject: "context-preview-test" })
      .action(retrieveCompany, { domain: "stripe.com" });

    expect(result).toEqual({
      description: "Financial infrastructure for the internet.",
      domain: "stripe.com",
      logoUrl: "https://cdn.example.com/stripe-logo.svg",
      name: "Stripe",
      primaryColor: "#635BFF",
    });
  });
});

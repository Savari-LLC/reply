import { ContextDev } from "@context-dot-dev/convex";
import { v } from "convex/values";

import { components } from "./_generated/api";
import { action } from "./_generated/server";

const contextDev = new ContextDev(components.contextDev);

const companyPreviewValidator = v.object({
  description: v.union(v.string(), v.null()),
  domain: v.string(),
  logoUrl: v.union(v.string(), v.null()),
  name: v.union(v.string(), v.null()),
  primaryColor: v.union(v.string(), v.null()),
});

export const retrieveCompany = action({
  args: { domain: v.string() },
  returns: v.union(companyPreviewValidator, v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Sign in before requesting company context");
    }

    const response = await contextDev.retrieveBrand(ctx, {
      params: { domain: args.domain },
    });
    const brand = response.brand;

    if (brand === undefined) {
      return null;
    }

    const preferredLogo =
      brand.logos?.find(
        (logo) => logo.type === "logo" && logo.mode === "light",
      ) ??
      brand.logos?.find((logo) => logo.type === "logo") ??
      brand.logos?.find((logo) => logo.type === "icon") ??
      brand.logos?.[0];

    return {
      description: brand.description ?? null,
      domain: brand.domain ?? args.domain,
      logoUrl: preferredLogo?.url ?? null,
      name: brand.title ?? null,
      primaryColor: brand.colors?.find((color) => color.hex !== undefined)?.hex ?? null,
    };
  },
});

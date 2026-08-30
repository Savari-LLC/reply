import { ContextDev } from "@context-dot-dev/convex";
import { v } from "convex/values";

import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
} from "./_generated/server";
import { requireWorkspaceContext } from "./authHelpers";
import { canAccessInbox } from "./lib/access";

const contextDev = new ContextDev(components.contextDev);

/** Stored profiles stay fresh for 90 days before a re-fetch is allowed. */
const PROFILE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

/** Reserved/demo TLDs that can never resolve to a real company. */
const UNRESOLVABLE_TLDS = [".test", ".example", ".invalid", ".localhost", ".local"];

type Brand = NonNullable<Awaited<ReturnType<ContextDev["retrieveBrand"]>>["brand"]>;

const profileFieldsValidator = v.object({
  name: v.string(),
  description: v.optional(v.string()),
  logoUrl: v.optional(v.string()),
  industry: v.optional(v.string()),
  website: v.optional(v.string()),
  slogan: v.optional(v.string()),
  primaryColor: v.optional(v.string()),
  location: v.optional(v.string()),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  socials: v.optional(v.array(v.object({ type: v.string(), url: v.string() }))),
});

/** Reduce a Context.dev brand response to the fields the product persists. */
function normalizeBrand(brand: Brand, domain: string) {
  const preferredLogo =
    brand.logos?.find((logo) => logo.type === "logo" && logo.mode === "light") ??
    brand.logos?.find((logo) => logo.type === "logo") ??
    brand.logos?.find((logo) => logo.type === "icon") ??
    brand.logos?.[0];
  const eic = brand.industries?.eic?.[0];
  const location = [brand.address?.city, brand.address?.country]
    .filter(Boolean)
    .join(", ");
  const socials = (brand.socials ?? []).flatMap((social) =>
    social.type && social.url ? [{ type: social.type, url: social.url }] : [],
  );
  return {
    name: brand.title ?? domain,
    description: brand.description ?? undefined,
    logoUrl: preferredLogo?.url ?? undefined,
    industry: eic
      ? [eic.industry, eic.subindustry].filter(Boolean).join(" · ")
      : undefined,
    website: `https://${brand.domain ?? domain}`,
    slogan: brand.slogan ?? undefined,
    primaryColor: brand.colors?.find((color) => color.hex !== undefined)?.hex ?? undefined,
    location: location.length > 0 ? location : undefined,
    email: brand.email ?? undefined,
    phone: brand.phone ?? undefined,
    socials: socials.length > 0 ? socials : undefined,
  };
}

/** Fetch from Context.dev and persist; shared by the client and scheduled paths. */
async function enrichAndPersist(
  ctx: ActionCtx,
  workspaceId: Id<"workspaces">,
  domain: string,
): Promise<void> {
  const normalized = domain.trim().toLowerCase();
  if (UNRESOLVABLE_TLDS.some((tld) => normalized.endsWith(tld))) return;

  let brand: Brand | undefined;
  try {
    const response = await contextDev.retrieveBrand(ctx, {
      params: { domain: normalized },
    });
    brand = response.brand;
  } catch {
    // NOT_FOUND, missing key, or network failure: leave the thread usable
    // without a company card instead of surfacing an inbox error.
    return;
  }
  if (brand === undefined) return;

  await ctx.runMutation(internal.companyContext.saveProfile, {
    workspaceId,
    domain: normalized,
    profile: normalizeBrand(brand, normalized),
  });
}

export const saveProfile = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    domain: v.string(),
    profile: profileFieldsValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("companyProfiles")
      .withIndex("by_workspaceId_and_domain", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("domain", args.domain),
      )
      .unique();
    const row = { ...args.profile, fetchedAt: Date.now() };
    if (existing) {
      await ctx.db.patch(existing._id, row);
    } else {
      await ctx.db.insert("companyProfiles", {
        workspaceId: args.workspaceId,
        domain: args.domain,
        ...row,
      });
    }
    return null;
  },
});

/** Scheduled from `inbox.simulateIncomingEmail`; args are trusted (internal). */
export const enrichDomain = internalAction({
  args: { workspaceId: v.id("workspaces"), domain: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await enrichAndPersist(ctx, args.workspaceId, args.domain);
    return null;
  },
});

export const getThreadEnrichmentTarget = internalQuery({
  args: { threadId: v.id("threads") },
  returns: v.union(
    v.object({
      workspaceId: v.id("workspaces"),
      domain: v.string(),
      hasFreshProfile: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const context = await requireWorkspaceContext(ctx);
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.workspaceId !== context.workspace._id) return null;
    const channel = await ctx.db.get(thread.channelId);
    const inbox = channel ? await ctx.db.get(channel.inboxId) : null;
    if (!inbox || !(await canAccessInbox(ctx, context.membership, inbox))) {
      return null;
    }
    const profile = await ctx.db
      .query("companyProfiles")
      .withIndex("by_workspaceId_and_domain", (q) =>
        q
          .eq("workspaceId", context.workspace._id)
          .eq("domain", thread.senderDomain),
      )
      .unique();
    return {
      workspaceId: context.workspace._id,
      domain: thread.senderDomain,
      hasFreshProfile:
        profile !== null && Date.now() - profile.fetchedAt < PROFILE_MAX_AGE_MS,
    };
  },
});

/**
 * Enrich the sender company of a thread the caller can access. Persists into
 * `companyProfiles`, so reactive thread queries pick the card up automatically.
 */
export const enrichThread = action({
  args: { threadId: v.id("threads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Sign in before requesting company context");
    }
    const target = await ctx.runQuery(
      internal.companyContext.getThreadEnrichmentTarget,
      { threadId: args.threadId },
    );
    if (!target || target.hasFreshProfile) return null;
    await enrichAndPersist(ctx, target.workspaceId, target.domain);
    return null;
  },
});

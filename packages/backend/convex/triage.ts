"use node";

import { convexGateway } from "@convex-dev/ai-sdk-provider";
import { generateObject } from "ai";
import { v } from "convex/values";
import { z } from "zod";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

/** Called through the Convex AI Gateway — no provider key to manage. */
const CLASSIFY_MODEL = "openai/gpt-5.6-luna";

/** Keep the prompt bounded even for very long inbound emails. */
const MAX_BODY_CHARS = 6_000;

const classificationSchema = z.object({
  category: z.enum([
    "quote_request",
    "booking",
    "technical",
    "billing",
    "complaint",
    "general",
  ]),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("How certain the category is, from 0 to 1."),
  shortSummary: z
    .string()
    .describe("One plain-business-language sentence describing what the sender needs."),
});

const SYSTEM_PROMPT = [
  "You triage inbound email for a small service business's shared inbox.",
  "Classify the email into exactly one category:",
  "- quote_request: asking for pricing, a proposal, or a quote.",
  "- booking: making, changing, or asking about a reservation or appointment.",
  "- technical: reporting that software, a website, an app, or a device is broken or misbehaving.",
  "- billing: invoices, charges, refunds, or payment administration.",
  "- complaint: expressing dissatisfaction with service or experience.",
  "- general: anything else.",
  "",
  "Guidance:",
  "- 'technical' requires a concrete malfunction report (errors, failures, broken flows), not general product questions.",
  "- Set confidence to reflect real uncertainty; use values below 0.85 when the category is plausible but not clear-cut.",
  "- shortSummary is one sentence, written for a business owner, e.g. \"Customer reports that checkout fails after clicking Pay.\"",
].join("\n");

/**
 * Automatic LLM triage. Scheduled right after an inbound email is stored;
 * writes the result onto the thread and lets `recordClassification` decide
 * whether a Devin investigation should start. Failures are silent — the
 * thread simply stays unclassified.
 */
export const classifyEmail = internalAction({
  args: { threadId: v.id("threads"), emailId: v.id("messages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.investigations.getClassificationContext, {
      threadId: args.threadId,
      emailId: args.emailId,
    });
    if (!context) return null;

    let result: z.infer<typeof classificationSchema>;
    try {
      const { object } = await generateObject({
        model: convexGateway(CLASSIFY_MODEL),
        schema: classificationSchema,
        system: SYSTEM_PROMPT,
        prompt: [
          `From: ${context.senderName} <${context.senderEmail}>`,
          `Subject: ${context.subject}`,
          "",
          context.body.slice(0, MAX_BODY_CHARS),
        ].join("\n"),
      });
      result = object;
    } catch (error) {
      console.error("Email classification failed", error);
      return null;
    }

    await ctx.runMutation(internal.investigations.recordClassification, {
      threadId: args.threadId,
      emailId: args.emailId,
      category: result.category,
      confidence: result.confidence,
      shortSummary: result.shortSummary,
    });
    return null;
  },
});

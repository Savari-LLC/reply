"use node";

import { convexGateway } from "@convex-dev/ai-sdk-provider";
import { generateText } from "ai";
import { v } from "convex/values";
import { z } from "zod";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

/**
 * Called through the Convex AI Gateway — no provider key to manage. The
 * gateway does not support JSON-schema response formats for this model, so
 * the classifier requests plain text and parses the JSON itself.
 */
const CLASSIFY_MODEL = "openai/gpt-5.6-luna";

/** Keep the prompt bounded even for very long inbound emails. */
const MAX_BODY_CHARS = 6_000;

/** One transient failure is retried once before giving up silently. */
const RETRY_DELAY_MS = 5_000;

const classificationSchema = z.object({
  category: z.enum([
    "quote_request",
    "booking",
    "technical",
    "billing",
    "complaint",
    "general",
  ]),
  confidence: z.number().min(0).max(1),
  shortSummary: z.string().min(1),
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
  "- confidence is a number between 0 and 1 reflecting real uncertainty; use values below 0.85 when the category is plausible but not clear-cut.",
  "- shortSummary is one sentence, written for a business owner, e.g. \"Customer reports that checkout fails after clicking Pay.\"",
  "",
  'Respond with ONLY a JSON object, no prose and no code fences, exactly like: {"category":"technical","confidence":0.94,"shortSummary":"..."}',
].join("\n");

/** Parse the model's reply, tolerating fences or stray prose around the JSON. */
function parseClassification(text: string): z.infer<typeof classificationSchema> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const result = classificationSchema.safeParse(JSON.parse(match[0]));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Automatic LLM triage. Scheduled right after an inbound email is stored;
 * writes the result onto the thread and lets `recordClassification` decide
 * whether a Devin investigation should start. Retries once on failure, then
 * gives up silently — the thread simply stays unclassified.
 */
export const classifyEmail = internalAction({
  args: {
    threadId: v.id("threads"),
    emailId: v.id("messages"),
    attempt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.investigations.getClassificationContext, {
      threadId: args.threadId,
      emailId: args.emailId,
    });
    if (!context) return null;

    let parsed: z.infer<typeof classificationSchema> | null = null;
    try {
      const { text } = await generateText({
        model: convexGateway(CLASSIFY_MODEL),
        system: SYSTEM_PROMPT,
        prompt: [
          `From: ${context.senderName} <${context.senderEmail}>`,
          `Subject: ${context.subject}`,
          "",
          context.body.slice(0, MAX_BODY_CHARS),
        ].join("\n"),
      });
      parsed = parseClassification(text);
    } catch (error) {
      console.error("Email classification request failed", error);
    }

    if (!parsed) {
      const attempt = args.attempt ?? 0;
      if (attempt < 1) {
        await ctx.scheduler.runAfter(RETRY_DELAY_MS, internal.triage.classifyEmail, {
          threadId: args.threadId,
          emailId: args.emailId,
          attempt: attempt + 1,
        });
      } else {
        console.error("Email classification gave up after retry", args.threadId);
      }
      return null;
    }

    await ctx.runMutation(internal.investigations.recordClassification, {
      threadId: args.threadId,
      emailId: args.emailId,
      category: parsed.category,
      confidence: parsed.confidence,
      shortSummary: parsed.shortSummary,
    });
    return null;
  },
});

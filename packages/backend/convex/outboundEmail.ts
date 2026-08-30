import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { Resend } from "@convex-dev/resend";
import { v } from "convex/values";

import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, env, internalQuery, query } from "./_generated/server";
import { requireIdentity, requireWorkspaceContext } from "./authHelpers";

const MAX_RECIPIENTS = 20;
const MAX_SUBJECT_LENGTH = 200;
const MAX_TEXT_LENGTH = 100_000;
const MAX_HTML_LENGTH = 500_000;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const outboundEmailRateLimiter = new RateLimiter(components.rateLimiter, {
  sendMessages: { kind: "fixed window", rate: 50, period: HOUR },
});

const resend = new Resend(components.resend, {
  apiKey: env.RESEND_API_KEY ?? "",
  testMode: false,
});

type OutboundMessageInput = {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  text: string;
  html?: string;
};

function normalizeRecipientGroup(values: string[], seen: Set<string>) {
  const recipients: string[] = [];
  for (const value of values) {
    const email = value.trim().toLowerCase();
    if (!email) continue;
    if (email.length > 254 || !emailPattern.test(email)) {
      throw new Error(`Enter a valid email address: ${email}`);
    }
    if (!seen.has(email)) {
      seen.add(email);
      recipients.push(email);
    }
  }
  return recipients;
}

export function normalizeOutboundMessage(input: OutboundMessageInput) {
  const recipientCount = input.to.length + input.cc.length + input.bcc.length;
  if (recipientCount > MAX_RECIPIENTS) {
    throw new Error(`Send to up to ${MAX_RECIPIENTS} recipients at a time`);
  }

  const seen = new Set<string>();
  const to = normalizeRecipientGroup(input.to, seen);
  const cc = normalizeRecipientGroup(input.cc, seen);
  const bcc = normalizeRecipientGroup(input.bcc, seen);
  if (to.length === 0) {
    throw new Error("Add at least one recipient");
  }

  const subject = input.subject.trim();
  if (!subject) throw new Error("Add a subject");
  if (subject.length > MAX_SUBJECT_LENGTH) {
    throw new Error(`Subject must be ${MAX_SUBJECT_LENGTH} characters or fewer`);
  }

  const text = input.text.trim();
  if (!text) throw new Error("Message body cannot be empty");
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error("Message body is too long");
  }

  const html = input.html?.trim();
  if (html && html.length > MAX_HTML_LENGTH) {
    throw new Error("Formatted message body is too long");
  }

  return { to, cc, bcc, subject, text, ...(html ? { html } : {}) };
}

function resendConfiguration() {
  const from = env.RESEND_FROM_EMAIL?.trim() ?? "";
  const apiKey = env.RESEND_API_KEY?.trim() ?? "";
  return {
    from,
    configured: Boolean(from && apiKey),
  };
}

export const getComposerConfig = query({
  args: {},
  returns: v.object({ from: v.string(), configured: v.boolean() }),
  handler: async (ctx) => {
    await requireWorkspaceContext(ctx);
    return resendConfiguration();
  },
});

export const getSendContext = internalQuery({
  args: {},
  returns: v.object({ workspaceId: v.id("workspaces") }),
  handler: async (ctx) => {
    const { workspace } = await requireWorkspaceContext(ctx);
    return { workspaceId: workspace._id };
  },
});

export const send = action({
  args: {
    to: v.array(v.string()),
    cc: v.array(v.string()),
    bcc: v.array(v.string()),
    subject: v.string(),
    text: v.string(),
    html: v.optional(v.string()),
  },
  returns: v.object({ emailId: v.string() }),
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    const message = normalizeOutboundMessage(args);
    const sendContext: { workspaceId: Id<"workspaces"> } = await ctx.runQuery(
      internal.outboundEmail.getSendContext,
      {},
    );
    const configuration = resendConfiguration();
    if (!configuration.configured) {
      throw new Error("Email delivery is not configured yet");
    }

    const rateLimit = await outboundEmailRateLimiter.limit(ctx, "sendMessages", {
      key: sendContext.workspaceId,
      count: message.to.length + message.cc.length + message.bcc.length,
    });
    if (!rateLimit.ok) {
      throw new Error(
        `Too many emails. Try again in ${Math.ceil(rateLimit.retryAfter / 60_000)} minutes.`,
      );
    }

    const emailId = await resend.sendEmail(ctx, {
      from: configuration.from,
      to: message.to,
      ...(message.cc.length > 0 ? { cc: message.cc } : {}),
      ...(message.bcc.length > 0 ? { bcc: message.bcc } : {}),
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    });
    return { emailId: String(emailId) };
  },
});

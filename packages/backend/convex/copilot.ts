"use node";

import { convexGateway } from "@convex-dev/ai-sdk-provider";
import { generateText } from "ai";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { requireIdentity } from "./authHelpers";

/** Called through the Convex AI Gateway — no provider key to manage. */
const DRAFT_MODEL = "openai/gpt-5.6-luna";

/** Keep the prompt bounded even for very long threads or pasted drafts. */
const MAX_MESSAGE_CHARS = 4_000;
const MAX_DRAFT_CHARS = 8_000;

/** What the operator asked Copilot to do with the composer contents. */
type CopilotMode = "draft" | "grammar" | "improve";

/** Shape returned by `internal.inbox.getDraftContext` (explicit to avoid
 * TypeScript circularity through the generated `api` types). */
type DraftContext = {
  workspaceName: string;
  agentName: string;
  subject: string;
  senderName: string;
  senderEmail: string;
  company: {
    name: string;
    description: string | null;
    industry: string | null;
    slogan: string | null;
    location: string | null;
    website: string | null;
  } | null;
  messages: {
    direction: "inbound" | "outbound";
    sender: string;
    sentAt: number;
    body: string;
  }[];
};

function formatTranscript(context: DraftContext): string {
  return context.messages
    .map((message) => {
      const role =
        message.direction === "inbound"
          ? `Customer (${message.sender})`
          : `${context.workspaceName} team (${message.sender})`;
      const when = new Date(message.sentAt).toISOString();
      return `[${when}] ${role}:\n${message.body.slice(0, MAX_MESSAGE_CHARS)}`;
    })
    .join("\n\n---\n\n");
}

/** Mode-specific instructions appended to the shared system prompt. */
function modeRequirements(mode: CopilotMode, context: DraftContext): string[] {
  if (mode === "grammar") {
    return [
      "Requirements for this edit:",
      "- The operator wrote a draft and only wants grammar fixed.",
      "- Correct grammar, spelling, and punctuation in the operator's draft. Do NOT rewrite sentences, change tone, add content, or remove content.",
      "- Preserve the operator's wording, structure, greeting, and sign-off exactly, apart from the corrections.",
      "- Return only the corrected email body text, nothing else.",
    ];
  }
  if (mode === "improve") {
    return [
      "Requirements for this edit:",
      "- The operator wrote a draft and wants the writing improved.",
      "- Improve clarity, flow, tone, and professionalism while preserving the draft's meaning, commitments, and any facts it states.",
      "- Do not invent new facts, prices, or commitments that are not in the draft or the thread.",
      "- Keep roughly the same length and keep the operator's greeting and sign-off (fix them only if awkward).",
      "- Return only the improved email body text, nothing else.",
    ];
  }
  return [
    "Requirements for the draft:",
    "- Write a complete, ready-to-send email body in plain text (no subject line, no markdown, no placeholders like [Name]).",
    "- Professional, warm, and concise. Mirror the customer's language and level of formality.",
    "- Answer every question the customer raised in the thread; if something needs confirmation, say so honestly instead of inventing facts, prices, or commitments.",
    "- Match the greeting to the customer's first name and sign off with the sender's first name.",
    `- Sign off as ${context.agentName}.`,
    "- Return only the email body text, nothing else.",
  ];
}

function buildSystemPrompt(context: DraftContext, mode: CopilotMode): string {
  const companyLines = context.company
    ? [
        "Verified company intelligence about the customer's organization (from Context.dev):",
        `- Company: ${context.company.name}`,
        context.company.description ? `- About: ${context.company.description}` : null,
        context.company.industry ? `- Industry: ${context.company.industry}` : null,
        context.company.slogan ? `- Slogan: ${context.company.slogan}` : null,
        context.company.location ? `- Location: ${context.company.location}` : null,
        context.company.website ? `- Website: ${context.company.website}` : null,
        "Use this to make the reply specific and commercially aware, but never recite it back as a list.",
      ].filter((line): line is string => line !== null)
    : ["No company profile is available for this sender; keep the reply grounded in the thread alone."];

  return [
    `You are Reply Copilot, drafting an email on behalf of ${context.agentName}, who works at ${context.workspaceName}.`,
    `You are replying to ${context.senderName} <${context.senderEmail}> on the thread "${context.subject}".`,
    "",
    ...companyLines,
    "",
    ...modeRequirements(mode, context),
  ].join("\n");
}

function buildUserPrompt(
  context: DraftContext,
  currentDraft: string | undefined,
  mode: CopilotMode,
): string {
  const sections = [
    "Conversation so far (oldest first):",
    formatTranscript(context),
  ];
  const draft = currentDraft?.trim();
  if (draft) {
    const intro =
      mode === "grammar"
        ? "The operator's draft to correct (fix grammar, spelling, and punctuation only):"
        : mode === "improve"
          ? "The operator's draft to improve (better clarity, flow, and tone; same meaning):"
          : "The operator already started this draft. Treat it as the intended direction: keep its substance and any commitments it makes, fix tone, clarity, and professionalism, and complete anything missing:";
    sections.push("", intro, draft.slice(0, MAX_DRAFT_CHARS));
  } else {
    sections.push("", "There is no existing draft. Write the reply from scratch.");
  }
  return sections.join("\n");
}

/**
 * Copilot writing assistance via the Convex AI Gateway. Reads the whole
 * thread, the operator's in-progress draft, and the persisted Context.dev
 * company profile; returns plain text for the composer, never sends anything.
 * `mode` selects drafting from scratch, grammar-only fixes, or improving the
 * operator's writing (the latter two require a current draft).
 */
export const generateDraft = action({
  args: {
    threadId: v.id("threads"),
    currentDraft: v.optional(v.string()),
    mode: v.optional(
      v.union(v.literal("draft"), v.literal("grammar"), v.literal("improve")),
    ),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    await requireIdentity(ctx);
    const mode: CopilotMode = args.mode ?? "draft";
    if (mode !== "draft" && !args.currentDraft?.trim()) {
      throw new Error("Write something first so Copilot has text to work with");
    }
    const context: DraftContext | null = await ctx.runQuery(
      internal.inbox.getDraftContext,
      { threadId: args.threadId },
    );
    if (context === null) throw new Error("Conversation not found");
    const { text } = await generateText({
      model: convexGateway(DRAFT_MODEL),
      system: buildSystemPrompt(context, mode),
      prompt: buildUserPrompt(context, args.currentDraft, mode),
    });
    const draft = text.trim();
    if (draft.length === 0) throw new Error("Copilot returned an empty draft");
    return draft;
  },
});

"use node";

import { v } from "convex/values";

import { internal } from "./_generated/api";
import { env, internalAction } from "./_generated/server";
import {
  buildInvestigationPrompt,
  mapDevinSession,
  STRUCTURED_OUTPUT_SCHEMA,
} from "./lib/devin";

const DEVIN_API_BASE = "https://api.devin.ai/v1";

/** Poll cadence and budget: every 15s for up to ~30 minutes. */
const POLL_INTERVAL_MS = 15_000;
const MAX_POLLS = 120;

function devinHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

/**
 * Open the Devin session for a queued investigation. Scheduled automatically
 * by `recordClassification`; configuration problems become clean, retryable
 * failure states instead of exceptions.
 */
export const startInvestigation = internalAction({
  args: { investigationId: v.id("investigations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.investigations.getStartContext, {
      investigationId: args.investigationId,
    });
    if (!context || context.status !== "queued") return null;

    const apiKey = env.DEVIN_API_KEY?.trim();
    if (!apiKey) {
      await ctx.runMutation(internal.investigations.markFailed, {
        investigationId: args.investigationId,
        error: {
          code: "not_configured",
          message: "Devin is not configured for this workspace yet.",
        },
      });
      return null;
    }
    if (!context.repoUrl) {
      await ctx.runMutation(internal.investigations.markFailed, {
        investigationId: args.investigationId,
        error: {
          code: "no_repository",
          message: "Connect your software repository to investigate technical issues.",
        },
      });
      return null;
    }

    let session: { session_id: string; url: string };
    try {
      const response = await fetch(`${DEVIN_API_BASE}/sessions`, {
        method: "POST",
        headers: devinHeaders(apiKey),
        body: JSON.stringify({
          prompt: buildInvestigationPrompt({ ...context, repoUrl: context.repoUrl }),
          title: `Investigate: ${context.subject}`,
          unlisted: true,
          tags: ["reply-auto-investigation"],
          structured_output_schema: STRUCTURED_OUTPUT_SCHEMA,
        }),
      });
      if (!response.ok) {
        throw new Error(`Devin responded with ${response.status}`);
      }
      session = (await response.json()) as { session_id: string; url: string };
    } catch (error) {
      console.error("Devin session start failed", error);
      await ctx.runMutation(internal.investigations.markFailed, {
        investigationId: args.investigationId,
        error: {
          code: "start_failed",
          message: "Investigation couldn't be started.",
        },
      });
      return null;
    }

    await ctx.runMutation(internal.investigations.applyProgress, {
      investigationId: args.investigationId,
      status: "investigating",
      currentStage: "understanding",
      devinSessionId: session.session_id,
      devinSessionUrl: session.url,
      startedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.devin.pollInvestigation, {
      investigationId: args.investigationId,
      devinSessionId: session.session_id,
      polls: 0,
    });
    return null;
  },
});

/**
 * Poll the Devin session and mirror its structured output into Convex; the
 * inbox UI updates through the reactive investigation queries. Reschedules
 * itself until the session reaches a terminal state or the budget runs out.
 */
export const pollInvestigation = internalAction({
  args: {
    investigationId: v.id("investigations"),
    devinSessionId: v.string(),
    polls: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const apiKey = env.DEVIN_API_KEY?.trim();
    if (!apiKey) return null;

    const reschedule = async () => {
      if (args.polls + 1 >= MAX_POLLS) {
        await ctx.runMutation(internal.investigations.markFailed, {
          investigationId: args.investigationId,
          error: {
            code: "investigation_failed",
            message: "Devin couldn't complete this investigation in time.",
          },
        });
        return;
      }
      await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.devin.pollInvestigation, {
        investigationId: args.investigationId,
        devinSessionId: args.devinSessionId,
        polls: args.polls + 1,
      });
    };

    let progress;
    try {
      const response = await fetch(
        `${DEVIN_API_BASE}/sessions/${encodeURIComponent(args.devinSessionId)}`,
        { headers: devinHeaders(apiKey) },
      );
      if (!response.ok) throw new Error(`Devin responded with ${response.status}`);
      progress = mapDevinSession(
        (await response.json()) as Parameters<typeof mapDevinSession>[0],
      );
    } catch (error) {
      // Transient API/network trouble: keep polling within the budget.
      console.error("Devin poll failed", error);
      await reschedule();
      return null;
    }

    if (progress.outcome === "failed") {
      await ctx.runMutation(internal.investigations.markFailed, {
        investigationId: args.investigationId,
        error: {
          code: "investigation_failed",
          message: "Devin couldn't complete this investigation.",
        },
      });
      return null;
    }

    const { outcome, ...fields } = progress;
    await ctx.runMutation(internal.investigations.applyProgress, {
      investigationId: args.investigationId,
      ...fields,
    });
    if (outcome === "running") await reschedule();
    return null;
  },
});

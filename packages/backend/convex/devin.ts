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

/** No single Devin API call may hang longer than this. */
const REQUEST_TIMEOUT_MS = 45_000;

function devinHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

/**
 * Open the Devin session for a queued investigation. Scheduled automatically
 * by `recordClassification`; every failure mode — missing key, missing repo,
 * API errors, malformed responses, unexpected exceptions — lands in a clean,
 * retryable failed state instead of leaving the investigation stuck.
 */
export const startInvestigation = internalAction({
  args: { investigationId: v.id("investigations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const fail = async (code: "not_configured" | "no_repository" | "start_failed", message: string) => {
      await ctx.runMutation(internal.investigations.markFailed, {
        investigationId: args.investigationId,
        error: { code, message },
      });
    };

    try {
      const context = await ctx.runQuery(internal.investigations.getStartContext, {
        investigationId: args.investigationId,
      });
      if (!context || context.status !== "queued") return null;

      const apiKey = env.DEVIN_API_KEY?.trim();
      if (!apiKey) {
        await fail("not_configured", "Devin is not configured for this workspace yet.");
        return null;
      }
      if (!context.repoUrl) {
        await fail(
          "no_repository",
          "Connect your software repository to investigate technical issues.",
        );
        return null;
      }

      const response = await fetch(`${DEVIN_API_BASE}/sessions`, {
        method: "POST",
        headers: devinHeaders(apiKey),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
      const session = (await response.json()) as { session_id?: unknown; url?: unknown };
      if (typeof session.session_id !== "string" || session.session_id.length === 0) {
        throw new Error("Devin returned no session id");
      }

      await ctx.runMutation(internal.investigations.applyProgress, {
        investigationId: args.investigationId,
        status: "investigating",
        currentStage: "understanding",
        devinSessionId: session.session_id,
        devinSessionUrl: typeof session.url === "string" ? session.url : undefined,
        startedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.devin.pollInvestigation, {
        investigationId: args.investigationId,
        devinSessionId: session.session_id,
        polls: 0,
      });
    } catch (error) {
      console.error("Devin session start failed", error);
      await fail("start_failed", "Investigation couldn't be started.");
    }
    return null;
  },
});

/**
 * Poll the Devin session and mirror its structured output into Convex; the
 * inbox UI updates through the reactive investigation queries. Reschedules
 * itself until the session reaches a terminal state or the budget runs out;
 * transient API trouble and even unexpected exceptions keep the loop alive
 * instead of killing it, and stale pollers (superseded by a retry or a
 * terminal state) stop themselves.
 */
export const pollInvestigation = internalAction({
  args: {
    investigationId: v.id("investigations"),
    devinSessionId: v.string(),
    polls: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
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

    try {
      // Stop silently if this poller no longer owns the investigation.
      const state = await ctx.runQuery(internal.investigations.getPollState, {
        investigationId: args.investigationId,
      });
      if (
        !state ||
        state.status === "completed" ||
        state.status === "failed" ||
        state.devinSessionId !== args.devinSessionId
      ) {
        return null;
      }

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

      const response = await fetch(
        `${DEVIN_API_BASE}/sessions/${encodeURIComponent(args.devinSessionId)}`,
        { headers: devinHeaders(apiKey), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
      );
      // The session is gone on Devin's side; retrying the poll cannot help.
      if (response.status === 404 || response.status === 410) {
        await ctx.runMutation(internal.investigations.markFailed, {
          investigationId: args.investigationId,
          error: {
            code: "investigation_failed",
            message: "Devin couldn't complete this investigation.",
          },
        });
        return null;
      }
      if (!response.ok) throw new Error(`Devin responded with ${response.status}`);

      const progress = mapDevinSession(
        (await response.json()) as Parameters<typeof mapDevinSession>[0],
      );

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
    } catch (error) {
      // Transient API/network/mapping trouble: keep polling within the budget.
      console.error("Devin poll failed", error);
      await reschedule();
    }
    return null;
  },
});

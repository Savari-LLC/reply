import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { parseGmailPushPayload, verifyGmailPushRequest } from "./gmailPush";
import {
  appSettingsUrl,
  decryptSecret,
  encryptSecret,
  exchangeAuthorizationCode,
  fetchProviderProfile,
  hashToken,
} from "./mailProvider";

const http = httpRouter();

/**
 * Schemes the mobile OAuth bridge may hand a sign-in code to: the installed
 * app (`reply://`) and Expo Go during development (`exp://`, `exp+reply://`).
 */
const ALLOWED_APP_SCHEMES = ["reply:", "exp:", "exp+reply:"];

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * OAuth redirect bridge for the native app.
 *
 * The auth component only allows http(s) `redirectTo` origins, but a native
 * app finishes sign-in on a custom scheme. The app starts its OAuth flow with
 * `redirectTo` pointing here (an allowed origin on this deployment), and this
 * page immediately forwards the one-time `convexAuthCode` (or error) to the
 * app's own URL so the in-app browser session can close.
 */
http.route({
  path: "/mobile/oauth",
  method: "GET",
  handler: httpAction(async (_ctx, request) => {
    const url = new URL(request.url);
    const appUrlRaw = url.searchParams.get("app");
    if (appUrlRaw === null) {
      return new Response("Missing app redirect", { status: 400 });
    }
    let appUrl: URL;
    try {
      appUrl = new URL(appUrlRaw);
    } catch {
      return new Response("Invalid app redirect", { status: 400 });
    }
    if (!ALLOWED_APP_SCHEMES.includes(appUrl.protocol)) {
      return new Response("App redirect scheme not allowed", { status: 400 });
    }
    for (const param of ["convexAuthCode", "convexAuthError"]) {
      const value = url.searchParams.get(param);
      if (value !== null) {
        appUrl.searchParams.set(param, value);
      }
    }
    const target = appUrl.toString();
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Returning to Reply…</title>
  </head>
  <body style="font-family: -apple-system, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: #eef0ec; color: #202d2a;">
    <p>Returning to the Reply app…<br /><a href="${escapeHtml(target)}">Tap here if nothing happens.</a></p>
    <script>window.location.replace(${JSON.stringify(target)});</script>
  </body>
</html>`;
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }),
});

function redirect(location: string) {
  return new Response(null, { status: 302, headers: { Location: location } });
}

http.route({
  path: "/mail/oauth/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const stateToken = url.searchParams.get("state");
    if (!stateToken) {
      return redirect(appSettingsUrl("error", "The provider did not return a valid connection state."));
    }
    try {
      const state = await ctx.runMutation(internal.mail.consumeOauthState, {
        stateHash: await hashToken(stateToken),
        now: Date.now(),
      });
      const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
      if (providerError) throw new Error(providerError);
      const code = url.searchParams.get("code");
      if (!code) throw new Error("The provider did not return an authorization code.");
      const verifier = await decryptSecret(state.codeVerifierEncrypted);
      const tokens = await exchangeAuthorizationCode(state.provider, code, verifier);
      const profile = await fetchProviderProfile(state.provider, tokens.accessToken);
      const [accessTokenEncrypted, refreshTokenEncrypted] = await Promise.all([
        encryptSecret(tokens.accessToken),
        tokens.refreshToken ? encryptSecret(tokens.refreshToken) : undefined,
      ]);
      const connection = await ctx.runMutation(internal.mail.completeOauth, {
        workspaceId: state.workspaceId,
        inboxId: state.inboxId,
        channelId: state.channelId,
        userId: state.userId,
        provider: state.provider,
        providerAccountId: profile.id,
        emailAddress: profile.emailAddress,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        accessTokenExpiresAt: tokens.expiresAt,
        scope: tokens.scope,
      });
      await ctx.scheduler.runAfter(0, internal.mailActions.syncConnectedChannel, {
        channelId: connection.channelId,
      });
      if (state.provider === "gmail") {
        await ctx.scheduler.runAfter(0, internal.mailActions.configureGmailWatch, {
          channelId: connection.channelId,
        });
      }
      return redirect(appSettingsUrl("connected"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Mailbox connection failed";
      return redirect(appSettingsUrl("error", message));
    }
  }),
});

http.route({
  path: "/mail/webhooks/gmail",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      await verifyGmailPushRequest(request);
    } catch {
      return new Response("Unauthorized", { status: 401 });
    }
    const rawBody = await request.text();
    if (rawBody.length > 64_000) return new Response("Payload too large", { status: 413 });
    let payload: ReturnType<typeof parseGmailPushPayload>;
    try {
      payload = parseGmailPushPayload(JSON.parse(rawBody) as unknown);
    } catch {
      return new Response("Invalid notification", { status: 400 });
    }
    await ctx.runMutation(internal.mail.queueGmailPushSync, {
      ...payload,
      now: Date.now(),
    });
    return new Response(null, { status: 204 });
  }),
});

export default http;

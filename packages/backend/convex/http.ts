import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import {
  appSettingsUrl,
  decryptSecret,
  encryptSecret,
  exchangeAuthorizationCode,
  fetchProviderProfile,
  hashToken,
} from "./mailProvider";

const http = httpRouter();

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
      return redirect(appSettingsUrl("connected"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Mailbox connection failed";
      return redirect(appSettingsUrl("error", message));
    }
  }),
});

export default http;

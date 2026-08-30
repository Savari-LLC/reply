import { setupCore } from "@convex-dev/auth/core/setup";
import { setupGoogle } from "@convex-dev/auth/providers/oauth/google";
import { setupUsernamePassword } from "@convex-dev/auth/providers/password/setup";

import { components, internal } from "./_generated/api";

const core = setupCore({ component: components.auth });

export const { signOut, refreshSession, isAuthenticated } = core;

export const { signUpWithPassword, signInWithPassword } = setupUsernamePassword(core, {
  component: components.authPasswordProvider,
  usernameComponent: components.authUsername,
}).attachUserCallbacks({ createUser: internal.users.createUserPassword });

// This deployment's own site origin is allowed so the native app can use the
// `/mobile/oauth` bridge (see convex/http.ts) as its OAuth redirect target.
const siteUrl = process.env.CONVEX_SITE_URL;

export const { startSignInGoogle, completeSignInGoogle } = setupGoogle(core, {
  component: components.oauthGoogle,
  allowedRedirectOrigins: [
    "https://reply-web-eight.vercel.app",
    "http://localhost:3001",
    "http://localhost:3002",
    ...(siteUrl ? [new URL(siteUrl).origin] : []),
  ],
}).attachUserCallbacks({ createUser: internal.users.createUserGoogle });

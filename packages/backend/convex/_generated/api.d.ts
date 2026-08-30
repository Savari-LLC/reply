/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as authHelpers from "../authHelpers.js";
import type * as channels from "../channels.js";
import type * as contextPreview from "../contextPreview.js";
import type * as healthCheck from "../healthCheck.js";
import type * as http from "../http.js";
import type * as inbox from "../inbox.js";
import type * as inboxes from "../inboxes.js";
import type * as invitations from "../invitations.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_cascade from "../lib/cascade.js";
import type * as members from "../members.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authHelpers: typeof authHelpers;
  channels: typeof channels;
  contextPreview: typeof contextPreview;
  healthCheck: typeof healthCheck;
  http: typeof http;
  inbox: typeof inbox;
  inboxes: typeof inboxes;
  invitations: typeof invitations;
  "lib/access": typeof lib_access;
  "lib/cascade": typeof lib_cascade;
  members: typeof members;
  seed: typeof seed;
  users: typeof users;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  auth: import("@convex-dev/auth/core/_generated/component.js").ComponentApi<"auth">;
  authPasswordProvider: import("@convex-dev/auth/providers/password/_generated/component.js").ComponentApi<"authPasswordProvider">;
  authUsername: import("@convex-dev/auth/username/_generated/component.js").ComponentApi<"authUsername">;
  oauthGoogle: import("@convex-dev/auth/providers/oauth/_generated/component.js").ComponentApi<"oauthGoogle">;
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  contextDev: import("@context-dot-dev/convex/_generated/component.js").ComponentApi<"contextDev">;
};

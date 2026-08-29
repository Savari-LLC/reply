import { setupCore } from "@convex-dev/auth/core/setup";

import { components } from "./_generated/api";

const core = setupCore({ component: components.auth });

export const { signOut, refreshSession, isAuthenticated } = core;

// Add the chosen Auth v2 provider and its app-owned user callbacks after the
// team agrees on the first product schema.

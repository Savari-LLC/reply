import contextDev from "@context-dot-dev/convex/convex.config.js";
import agent from "@convex-dev/agent/convex.config.js";
import auth from "@convex-dev/auth/core/convex.config.js";
import passkey from "@convex-dev/auth/providers/passkey/convex.config.js";
import username from "@convex-dev/auth/username/convex.config.js";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    AUTH_PRIVATE_KEY: v.string(),
    AUTH_JWKS: v.string(),
    CONTEXT_DEV_API_KEY: v.string(),
  },
});

app.use(auth, {
  httpPrefix: "/auth",
  env: {
    AUTH_PRIVATE_KEY: app.env.AUTH_PRIVATE_KEY,
    AUTH_JWKS: app.env.AUTH_JWKS,
  },
});
app.use(passkey);
app.use(username);
app.use(agent);
app.use(contextDev, {
  env: {
    CONTEXT_DEV_API_KEY: app.env.CONTEXT_DEV_API_KEY,
  },
});

export default app;

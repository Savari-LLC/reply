import type { Doc } from "./_generated/dataModel";

/**
 * Legacy demo teammates created by the removed sample-data seeding. They were
 * namespaced per workspace and never registered with the auth provider, so
 * they cannot sign in; member management still recognizes them so existing
 * workspaces can clean them up.
 */
export function isSeedUser(user: Doc<"users">) {
  return (
    user.authProvider === "password" &&
    (user.providerAccountId?.startsWith("seed|") ?? false)
  );
}

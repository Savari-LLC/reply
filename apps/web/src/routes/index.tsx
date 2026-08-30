import { createFileRoute, redirect } from "@tanstack/react-router";

type HomeSearchParams = { invite?: string };

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): HomeSearchParams => ({
    invite: typeof search.invite === "string" ? search.invite : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/inbox",
      search: search.invite ? { invite: search.invite } : {},
    });
  },
});

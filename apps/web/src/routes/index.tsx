import { createFileRoute, redirect } from "@tanstack/react-router";

/** The inbox is the product: land everyone there (it handles sign-in itself). */
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/inbox" });
  },
});

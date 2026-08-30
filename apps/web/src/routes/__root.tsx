import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { api } from "@reply/backend/convex/_generated/api";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import { Toaster } from "@reply/ui/components/sonner";
import { TooltipProvider } from "@reply/ui/components/tooltip";
import type { QueryClient } from "@tanstack/react-query";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import appCss from "../index.css?url";

export interface RouterAppContext {
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Reply — hackathon starter",
      },
      {
        name: "description",
        content: "The prepared technical foundation and build plan for the Reply hackathon project.",
      },
      {
        name: "theme-color",
        content: "#202d2a",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.svg",
        type: "image/svg+xml",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  component: RootDocument,
});

function RootDocument() {
  const { convexQueryClient } = Route.useRouteContext();
  return (
    <ConvexAuthProvider client={convexQueryClient.convexClient} api={api.auth}>
      <html lang="en">
        <head>
          <HeadContent />
        </head>
        <body>
          <TooltipProvider>
            <Outlet />
          </TooltipProvider>
          <Toaster richColors position="bottom-right" />
          {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-left" />}
          <Scripts />
        </body>
      </html>
    </ConvexAuthProvider>
  );
}

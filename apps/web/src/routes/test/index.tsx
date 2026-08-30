import { api } from "@reply/backend/convex/_generated/api";
import { Badge } from "@reply/ui/components/badge";
import { Button, buttonVariants } from "@reply/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@reply/ui/components/select";
import { Skeleton } from "@reply/ui/components/skeleton";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Inbox, Mail, TriangleAlert, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { statusStyles, timeAgo } from "../../lib/test-page";

type SearchParams = { inbox?: string; actor?: string };

export const Route = createFileRoute("/test/")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    inbox: typeof search.inbox === "string" ? search.inbox : undefined,
    actor: typeof search.actor === "string" ? search.actor : undefined,
  }),
  component: TestInboxPage,
  errorComponent: TestPageError,
});

function TestPageError({ error }: { error: Error }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
      <TriangleAlert className="size-8 text-destructive" />
      <h1 className="text-lg font-semibold">Test page error</h1>
      <p className="max-w-md text-sm text-muted-foreground">{error.message}</p>
      <Link to="/test" className={buttonVariants({ variant: "outline" })}>
        Reset
      </Link>
    </main>
  );
}

function TestInboxPage() {
  const { inbox, actor } = Route.useSearch();
  const navigate = Route.useNavigate();
  const inboxes = useQuery(api.demo.listInboxes, { actor });
  const threads = useQuery(api.demo.listThreads, { inboxId: inbox, actor });
  const teammates = useQuery(api.demo.listTeammates);
  const ensureSeeded = useMutation(api.demo.ensureSeeded);
  const [seeding, setSeeding] = useState(false);

  if (inboxes === undefined) {
    return (
      <main className="mx-auto max-w-5xl space-y-3 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </main>
    );
  }

  if (inboxes === null) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
        <Inbox className="size-10 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-semibold">No demo data yet</h1>
          <p className="text-sm text-muted-foreground">
            Seed the demo workspace to start testing.
          </p>
        </div>
        <Button
          disabled={seeding}
          onClick={async () => {
            setSeeding(true);
            try {
              await ensureSeeded({});
              toast.success("Demo data seeded");
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Seeding failed",
              );
            } finally {
              setSeeding(false);
            }
          }}
        >
          {seeding ? "Seeding…" : "Seed demo data"}
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-6xl flex-col gap-6 p-4 sm:p-6 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-64">
        <h1 className="mb-3 text-lg font-bold tracking-tight">
          Test inbox
          <span className="ml-2 align-middle text-[10px] font-medium uppercase text-muted-foreground">
            internal
          </span>
        </h1>
        <div className="mb-4 flex items-center gap-2">
          <UserRound className="size-4 text-muted-foreground" />
          <Select
            value={actor ?? "maya"}
            onValueChange={(value) =>
              navigate({ search: { inbox, actor: value ?? undefined } })
            }
          >
            <SelectTrigger className="h-8 flex-1" aria-label="Testing as">
              <SelectValue placeholder="Testing as" />
            </SelectTrigger>
            <SelectContent>
              {(teammates ?? []).map((teammate) => (
                <SelectItem key={teammate._id} value={teammate.username}>
                  Testing as {teammate.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
          <button
            type="button"
            onClick={() => navigate({ search: { actor } })}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap transition-colors hover:bg-accent ${!inbox ? "bg-accent font-semibold" : ""}`}
          >
            <Inbox className="size-4" />
            All conversations
          </button>
          {inboxes.map((item) => (
            <button
              key={item._id}
              type="button"
              onClick={() => navigate({ search: { inbox: item._id, actor } })}
              className={`flex flex-col gap-0.5 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap transition-colors hover:bg-accent ${inbox === item._id ? "bg-accent font-semibold" : ""}`}
            >
              <span className="flex items-center gap-2">
                <Mail className="size-4" />
                {item.name}
                {item.unreadCount > 0 && (
                  <Badge className="ml-auto rounded-full px-1.5 py-0 text-[10px]">
                    {item.unreadCount}
                  </Badge>
                )}
              </span>
              {item.channel && (
                <span className="pl-6 text-[11px] font-normal text-muted-foreground">
                  {item.channel.emailAddress} · {item.channel.provider}
                </span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      <section className="min-w-0 flex-1">
        {threads === undefined ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : threads === null ? (
          <p className="p-6 text-sm text-muted-foreground">
            Inbox not found.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => navigate({ search: { actor } })}
            >
              Show all conversations
            </button>
          </p>
        ) : threads.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No conversations.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-background">
            {threads.map((thread) => (
              <li key={thread._id}>
                <Link
                  to="/test/$threadId"
                  params={{ threadId: thread._id }}
                  search={{ actor }}
                  className="block px-4 py-3 transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-center gap-2">
                    <span
                      aria-label={thread.unread ? "Unread" : "Read"}
                      className={`size-2 shrink-0 rounded-full ${thread.unread ? "bg-blue-500" : "bg-transparent"}`}
                    />
                    <span
                      className={`truncate text-sm ${thread.unread ? "font-semibold" : "font-medium"}`}
                    >
                      {thread.subject}
                    </span>
                    {thread.priority === "urgent" && (
                      <Badge variant="destructive" className="rounded-full text-[10px]">
                        Urgent
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={`rounded-full text-[10px] capitalize ${statusStyles[thread.status] ?? ""}`}
                    >
                      {thread.status}
                    </Badge>
                    <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                      {timeAgo(thread.lastMessageAt)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 pl-4 text-xs text-muted-foreground">
                    <span className="shrink-0 font-medium text-foreground/80">
                      {thread.senderName}
                    </span>
                    <span className="truncate">{thread.preview}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 pl-4">
                    {thread.labels.map((label) => (
                      <Badge
                        key={label.name}
                        variant="outline"
                        className="rounded-full text-[10px]"
                        style={{ borderColor: label.color, color: label.color }}
                      >
                        {label.name}
                      </Badge>
                    ))}
                    {thread.assignee && (
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        Assigned to {thread.assignee.name}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

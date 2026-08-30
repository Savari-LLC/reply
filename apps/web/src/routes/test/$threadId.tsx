import { api } from "@reply/backend/convex/_generated/api";
import type { Id } from "@reply/backend/convex/_generated/dataModel";
import { Badge } from "@reply/ui/components/badge";
import { Button, buttonVariants } from "@reply/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@reply/ui/components/select";
import { Separator } from "@reply/ui/components/separator";
import { Skeleton } from "@reply/ui/components/skeleton";
import { Textarea } from "@reply/ui/components/textarea";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Building2, Send, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { statusStyles, timeAgo } from "../../lib/test-page";

type SearchParams = { actor?: string };

export const Route = createFileRoute("/test/$threadId")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    actor: typeof search.actor === "string" ? search.actor : undefined,
  }),
  component: TestThreadPage,
  errorComponent: TestThreadError,
});

function TestThreadError({ error }: { error: Error }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
      <TriangleAlert className="size-8 text-destructive" />
      <h1 className="text-lg font-semibold">Test page error</h1>
      <p className="max-w-md text-sm text-muted-foreground">{error.message}</p>
      <Link to="/test" className={buttonVariants({ variant: "outline" })}>
        Back to inbox
      </Link>
    </main>
  );
}

const UNASSIGNED = "unassigned";

function TestThreadPage() {
  const { threadId } = Route.useParams();
  const { actor } = Route.useSearch();
  const thread = useQuery(api.demo.getThread, { threadId, actor });
  const teammates = useQuery(api.demo.listTeammates);
  const markRead = useMutation(api.demo.markRead);
  const setStatus = useMutation(api.demo.setStatus);
  const assign = useMutation(api.demo.assign);
  const sendReply = useMutation(api.demo.sendReply);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const threadRealId = thread?._id;
  useEffect(() => {
    if (thread?.unread && threadRealId) {
      markRead({ threadId: threadRealId, actor }).catch(() => {});
    }
  }, [thread?.unread, threadRealId, actor, markRead]);

  if (thread === undefined) {
    return (
      <main className="mx-auto max-w-3xl space-y-3 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </main>
    );
  }

  if (thread === null) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
        <TriangleAlert className="size-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Thread not found</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          This conversation does not exist in the demo workspace. It may have
          been removed by a reseed.
        </p>
        <Link
          to="/test"
          search={{ actor }}
          className={buttonVariants({ variant: "outline" })}
        >
          Back to inbox
        </Link>
      </main>
    );
  }

  const run = (action: Promise<unknown>, success?: string) =>
    action
      .then(() => success && toast.success(success))
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "Action failed"),
      );

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <Link
        to="/test"
        search={{ actor }}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to inbox
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">{thread.subject}</h1>
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
        </div>
        <p className="text-sm text-muted-foreground">
          {thread.senderName} &lt;{thread.senderEmail}&gt; · {thread.inboxName}{" "}
          inbox · {timeAgo(thread.lastMessageAt)}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={thread.status}
            onValueChange={(status) =>
              run(
                setStatus({
                  threadId: thread._id,
                  status: status as "open" | "waiting" | "closed",
                }),
                `Status set to ${status}`,
              )
            }
          >
            <SelectTrigger className="w-32" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="waiting">Waiting</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={thread.assignee?._id ?? UNASSIGNED}
            onValueChange={(value) =>
              run(
                assign({
                  threadId: thread._id,
                  teammateId:
                    value === UNASSIGNED ? null : (value as Id<"users">),
                }),
                "Assignee updated",
              )
            }
          >
            <SelectTrigger className="w-44" aria-label="Assignee">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {(teammates ?? []).map((teammate) => (
                <SelectItem key={teammate._id} value={teammate._id}>
                  {teammate.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {thread.companyProfile && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border bg-muted/30 p-4">
          <Building2 className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold">
              {thread.companyProfile.name}
              {thread.companyProfile.industry && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {thread.companyProfile.industry}
                </span>
              )}
            </p>
            {thread.companyProfile.description && (
              <p className="mt-0.5 text-muted-foreground">
                {thread.companyProfile.description}
              </p>
            )}
            {thread.companyProfile.website && (
              <a
                href={thread.companyProfile.website}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-xs text-blue-600 hover:underline"
              >
                {thread.companyProfile.website}
              </a>
            )}
          </div>
        </div>
      )}

      <Separator className="my-5" />

      <ol className="space-y-3">
        {thread.messages.map((message) => (
          <li
            key={message._id}
            className={`max-w-[85%] rounded-xl border p-4 text-sm ${
              message.direction === "outbound"
                ? "ml-auto border-blue-100 bg-blue-50"
                : "bg-background"
            }`}
          >
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              {message.direction === "outbound"
                ? (message.author ?? "Reply team")
                : (message.senderName ?? thread.senderName)}{" "}
              · {timeAgo(message.sentAt)}
            </p>
            <p className="whitespace-pre-wrap leading-relaxed">{message.body}</p>
          </li>
        ))}
      </ol>

      <form
        className="mt-6 space-y-2"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!draft.trim()) return;
          setSending(true);
          try {
            await sendReply({ threadId: thread._id, body: draft, actor });
            setDraft("");
            toast.success("Reply sent — thread moved to Waiting");
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Failed to send",
            );
          } finally {
            setSending(false);
          }
        }}
      >
        <label htmlFor="reply-body" className="text-sm font-medium">
          Reply
        </label>
        <Textarea
          id="reply-body"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={`Reply to ${thread.senderName}…`}
          rows={4}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={sending || !draft.trim()}>
            <Send className="size-4" />
            {sending ? "Sending…" : "Send reply"}
          </Button>
        </div>
      </form>
    </main>
  );
}

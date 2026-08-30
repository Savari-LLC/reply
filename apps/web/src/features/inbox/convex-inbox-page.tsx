import { useAuthActions } from "@convex-dev/auth/react";
import usePresence from "@convex-dev/presence/react";
import { api } from "@reply/backend/convex/_generated/api";
import type { Id } from "@reply/backend/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { INITIAL_OPERATIONS, TOAST_IDS } from "./constants";
import { InboxScreen } from "./inbox-screen";
import type { InboxController, LoadScope } from "./model";
import type {
  AsyncStatus,
  CommentDraft,
  CompanyProfile,
  InboxScreenState,
  InboxSummary,
  LabelAccent,
  ListStatus,
  Message,
  OperationKey,
  ScreenStatus,
  Teammate,
  ThreadDetail,
  ThreadComment,
  ThreadPaneStatus,
  ThreadSummary,
  ThreadViewer,
} from "./types";
import { getInitials } from "./utils";

type PresenceEntry = {
  userId: string;
  online: boolean;
  lastDisconnected: number;
  name?: string;
  image?: string;
};

/**
 * Headless presence subscriber. Mounted only while a thread is selected and
 * the user is known; heartbeats the thread room and reports who is online.
 * Identity is re-derived server-side — the userId here only marks "self".
 */
function PresenceReporter({
  threadId,
  userId,
  onChange,
}: {
  threadId: string;
  userId: string;
  onChange: (entries: PresenceEntry[]) => void;
}) {
  const state = usePresence(api.presence, threadId, userId);
  useEffect(() => {
    onChange((state as PresenceEntry[] | undefined) ?? []);
  }, [state, onChange]);
  return null;
}

type InboxRow = NonNullable<FunctionReturnType<typeof api.inbox.listInboxes>>[number];
type ThreadRow = NonNullable<FunctionReturnType<typeof api.inbox.listThreads>>[number];
type ThreadDetailRow = NonNullable<FunctionReturnType<typeof api.inbox.getThread>>;
type TeammateRow = NonNullable<FunctionReturnType<typeof api.inbox.listTeammates>>[number];

/** Known inbox accents; unknown inboxes rotate through the fallback list. */
const INBOX_ACCENTS: Record<string, LabelAccent> = {
  sales: "purple",
  accounts: "blue",
  support: "magenta",
};

const FALLBACK_ACCENTS: LabelAccent[] = ["purple", "blue", "magenta", "amber", "yellow"];

/** Seeded label colors mapped onto the frozen accent palette. */
const LABEL_COLOR_ACCENTS: Record<string, LabelAccent> = {
  "#2563eb": "blue", // New lead
  "#9333ea": "purple", // VIP
  "#d97706": "amber", // Billing
  "#dc2626": "magenta", // Bug
  "#059669": "yellow", // Renewal
  "#0891b2": "blue", // Feature request
};

function mapInbox(row: InboxRow, index: number): InboxSummary {
  const slug = row.name.toLowerCase();
  return {
    id: row._id,
    name: row.name,
    slug,
    kind: row.kind,
    displayOrder: index,
    unreadCount: row.unreadCount,
    accent:
      row.kind === "personal"
        ? "yellow"
        : (INBOX_ACCENTS[slug] ?? FALLBACK_ACCENTS[index % FALLBACK_ACCENTS.length]!),
    hasChannel: row.channels.length > 0,
  };
}

function mapTeammate(row: TeammateRow): Teammate {
  return {
    id: row._id,
    name: row.name,
    initials: getInitials(row.name),
    avatarUrl: row.imageUrl ?? undefined,
    role: "Teammate",
  };
}

function mapThread(row: ThreadRow): ThreadSummary {
  return {
    id: row._id,
    inboxId: row.inboxId ?? "",
    customerName: row.senderName,
    customerEmail: row.senderEmail,
    companyName: row.company?.name,
    companyLogoUrl: row.company?.logoUrl ?? undefined,
    subject: row.subject,
    preview: row.preview,
    status: row.status,
    priority: row.priority,
    assigneeId: row.assignee?._id ?? null,
    labels: row.labels.map((label) => ({
      id: label.name,
      name: label.name,
      accent: LABEL_COLOR_ACCENTS[label.color.toLowerCase()] ?? "blue",
    })),
    unread: row.unread,
    lastActivityAt: row.lastMessageAt,
  };
}

function mapMessages(detail: ThreadDetailRow): Message[] {
  return detail.messages.map((message) => ({
    id: message._id,
    threadId: detail._id,
    direction: message.direction,
    authorName:
      message.direction === "inbound"
        ? (message.senderName ?? detail.senderName)
        : (message.author ?? "Teammate"),
    authorEmail: message.direction === "inbound" ? detail.senderEmail : undefined,
    authorImageUrl:
      message.direction === "outbound" ? (message.authorImageUrl ?? undefined) : undefined,
    recipientEmail: message.direction === "outbound" ? detail.senderEmail : undefined,
    body: message.body,
    sentAt: message.sentAt,
  }));
}

function mapComments(detail: ThreadDetailRow): ThreadComment[] {
  return detail.comments.map((comment) => ({
    id: comment._id,
    threadId: detail._id,
    authorId: comment.authorId,
    authorName: comment.authorName,
    authorImageUrl: comment.authorImageUrl ?? undefined,
    body: comment.body,
    sentAt: comment.sentAt,
    mentions: comment.mentions,
    attachments: comment.attachments,
  }));
}

function mapStoredCompany(detail: ThreadDetailRow): CompanyProfile | undefined {
  const profile = detail.companyProfile;
  if (!profile) return undefined;
  return {
    name: profile.name,
    domain: detail.senderDomain,
    description: profile.description ?? undefined,
    industry: profile.industry ?? undefined,
    logoUrl: profile.logoUrl ?? undefined,
    location: profile.location ?? undefined,
    slogan: profile.slogan ?? undefined,
    primaryColor: profile.primaryColor ?? undefined,
    website: profile.website ?? undefined,
    email: profile.email ?? undefined,
    phone: profile.phone ?? undefined,
    socials: profile.socials.length > 0 ? profile.socials : undefined,
  };
}

/**
 * Convex-backed implementation of the `InboxController` seam. Data loads
 * reactively (assignments, statuses, replies, and unread counts update live);
 * local state only tracks selection and per-operation progress.
 */
export function ConvexInboxPage() {
  const { signOut } = useAuthActions();
  const profile = useQuery(api.users.getProfile, {});
  const me = useQuery(api.users.getCurrent, {});
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const inboxes = useQuery(api.inbox.listInboxes, {});
  const teammateRows = useQuery(api.inbox.listTeammates, {});
  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const threadRows = useQuery(
    api.inbox.listThreads,
    selectedInboxId ? { inboxId: selectedInboxId as Id<"inboxes"> } : "skip",
  );
  const detailRow = useQuery(
    api.inbox.getThread,
    selectedThreadId ? { threadId: selectedThreadId } : "skip",
  );

  const ensureSetup = useMutation(api.inbox.ensureSetup);
  const markRead = useMutation(api.inbox.markRead);
  const assignMutation = useMutation(api.inbox.assign);
  const setStatusMutation = useMutation(api.inbox.setStatus);
  const sendReplyMutation = useMutation(api.inbox.sendReply);
  const addCommentMutation = useMutation(api.inbox.addComment);
  const generateCommentUploadUrl = useMutation(api.inbox.generateCommentUploadUrl);
  const simulateMutation = useMutation(api.simulate.simulateIncomingEmail);
  const enrichThread = useAction(api.companyContext.enrichThread);

  const [operations, setOperations] = useState(INITIAL_OPERATIONS);
  const setOperation = useCallback(
    (key: OperationKey, status: AsyncStatus, message?: string) => {
      setOperations((prev) => ({ ...prev, [key]: { status, message } }));
    },
    [],
  );

  // First load: guarantee the member's personal inbox exists (idempotent).
  const [setupError, setSetupError] = useState<string | null>(null);
  const setupRef = useRef(false);
  const runSetup = useCallback(async () => {
    if (setupRef.current) return;
    setupRef.current = true;
    setSetupError(null);
    try {
      await ensureSetup({});
    } catch (error) {
      setupRef.current = false;
      setSetupError(
        error instanceof Error
          ? error.message
          : "Your workspace could not be prepared.",
      );
    }
  }, [ensureSetup]);

  useEffect(() => {
    void runSetup();
  }, [runSetup]);

  // Default to the first inbox once the workspace loads.
  useEffect(() => {
    if (!selectedInboxId && inboxes && inboxes.length > 0) {
      setSelectedInboxId(inboxes[0]!._id);
    }
  }, [inboxes, selectedInboxId]);

  // Opening an unread conversation marks it read for the current user.
  const detailId = detailRow?._id;
  const detailUnread = detailRow?.unread;
  useEffect(() => {
    if (detailId && detailUnread) {
      markRead({ threadId: detailId }).catch(() => {});
    }
  }, [detailId, detailUnread, markRead]);

  // Live Context.dev enrichment for domains without a stored company profile.
  // The action persists into `companyProfiles`, so the reactive `getThread`
  // query delivers the finished card (and it survives refresh).
  const [enrichment, setEnrichment] = useState<Record<string, "pending" | "done">>({});
  const requestedDomains = useRef<Set<string>>(new Set());
  const missingThreadId = detailRow && !detailRow.companyProfile ? detailRow._id : null;
  const missingDomain =
    detailRow && !detailRow.companyProfile ? detailRow.senderDomain : null;
  useEffect(() => {
    if (!missingThreadId || !missingDomain) return;
    if (requestedDomains.current.has(missingDomain)) return;
    requestedDomains.current.add(missingDomain);
    setEnrichment((prev) => ({ ...prev, [missingDomain]: "pending" }));
    enrichThread({ threadId: missingThreadId as Id<"threads"> })
      .catch(() => {})
      .finally(() => {
        setEnrichment((prev) => ({ ...prev, [missingDomain]: "done" }));
      });
  }, [missingThreadId, missingDomain, enrichThread]);

  const state = useMemo<InboxScreenState>(() => {
    const screenStatus: ScreenStatus = setupError
      ? "error"
      : !inboxes || !teammateRows
        ? "loading"
        : "ready";

    const listStatus: ListStatus = !selectedInboxId
      ? "idle"
      : threadRows === undefined
        ? "loading"
        : threadRows === null
          ? "error"
          : threadRows.length === 0
            ? "empty"
            : "ready";

    const threadStatus: ThreadPaneStatus = !selectedThreadId
      ? "idle"
      : detailRow === undefined
        ? "loading"
        : detailRow === null
          ? "error"
          : "ready";

    let selectedThread: ThreadDetail | null = null;
    if (detailRow) {
      const company = mapStoredCompany(detailRow);
      const companyStatus = company
        ? "ready"
        : enrichment[detailRow.senderDomain] === "done"
          ? "unavailable"
          : "loading";
      selectedThread = {
        thread: {
          ...mapThread(detailRow),
          companyName: company?.name,
        },
        messages: mapMessages(detailRow),
        comments: mapComments(detailRow),
        company,
        companyStatus,
      };
    }

    return {
      screenStatus,
      screenError: setupError ?? undefined,
      inboxes: inboxes?.map(mapInbox) ?? [],
      teammates: teammateRows?.map(mapTeammate) ?? [],
      selectedInboxId,
      selectedThreadId,
      listStatus,
      listError:
        listStatus === "error" ? "Conversations could not load." : undefined,
      threads: threadRows?.map(mapThread) ?? [],
      threadStatus,
      threadError:
        threadStatus === "error" ? "This conversation could not load." : undefined,
      selectedThread,
      operations,
    };
  }, [
    setupError,
    inboxes,
    teammateRows,
    selectedInboxId,
    selectedThreadId,
    threadRows,
    detailRow,
    enrichment,
    operations,
  ]);

  const runMutation = useCallback(
    async (
      key: OperationKey,
      mutate: () => Promise<unknown>,
      options?: {
        toastId?: string;
        successToast?: { title: string; description?: string };
        retry?: () => void;
      },
    ) => {
      setOperation(key, "loading");
      try {
        await mutate();
      } catch (error) {
        setOperation(key, "error", "The change could not be saved.");
        toast.error("The change could not be saved.", {
          id: options?.toastId ?? `inbox-${key}`,
          action: options?.retry
            ? { label: "Retry", onClick: options.retry }
            : undefined,
        });
        throw error;
      }
      setOperation(key, "success");
      if (options?.successToast) {
        toast.success(options.successToast.title, {
          id: options?.toastId ?? `inbox-${key}`,
          description: options.successToast.description,
        });
      }
    },
    [setOperation],
  );

  const controller = useMemo<InboxController>(() => {
    const selectInbox = (inboxId: string) => {
      setSelectedInboxId(inboxId);
      setSelectedThreadId(null);
    };

    const selectThread = (threadId: string) => {
      setSelectedThreadId(threadId);
    };

    const assignThread = async (threadId: string, teammateId: string) =>
      runMutation(
        "assign",
        () =>
          assignMutation({
            threadId: threadId as Id<"threads">,
            teammateId: teammateId as Id<"users">,
          }),
        {
          toastId: TOAST_IDS.assign,
          retry: () => void assignThread(threadId, teammateId).catch(() => undefined),
        },
      );

    const setStatus = async (threadId: string, status: ThreadSummary["status"]) =>
      runMutation(
        "status",
        () => setStatusMutation({ threadId: threadId as Id<"threads">, status }),
        {
          toastId: TOAST_IDS.status,
          successToast:
            status === "closed" ? { title: "Conversation marked Done." } : undefined,
          retry: () => void setStatus(threadId, status).catch(() => undefined),
        },
      );

    const setUnread = async (threadId: string, unread: boolean) => {
      if (unread) {
        toast.info("Marking as unread isn't available yet.", {
          id: TOAST_IDS.unread,
        });
        return;
      }
      return runMutation(
        "unread",
        () => markRead({ threadId: threadId as Id<"threads"> }),
        {
          toastId: TOAST_IDS.unread,
          retry: () => void setUnread(threadId, unread).catch(() => undefined),
        },
      );
    };

    const setPriority = async () => {
      toast.info("Priority changes aren't available yet.", {
        id: TOAST_IDS.priority,
      });
    };

    const setLabels = async () => {
      toast.info("Label editing isn't available yet.", { id: TOAST_IDS.labels });
    };

    const generateDraft = async (): Promise<string> => {
      setOperation("draft", "error", "Copilot drafting isn't connected yet.");
      throw new Error("Copilot drafting isn't connected yet.");
    };

    const sendReply = async (threadId: string, body: string) => {
      setOperation("send", "loading");
      try {
        await sendReplyMutation({ threadId: threadId as Id<"threads">, body });
      } catch (error) {
        setOperation("send", "error", "Your reply could not be sent.");
        toast.error("Your reply could not be sent.", {
          id: TOAST_IDS.send,
          description: "Your draft is preserved — try again.",
        });
        throw error;
      }
      setOperation("send", "success");
      toast.success("Reply sent", {
        id: TOAST_IDS.send,
        description: "Conversation moved to Waiting.",
      });
    };

    const addComment = async (threadId: string, draft: CommentDraft) => {
      setOperation("comment", "loading");
      try {
        // Upload attachments first; the mutation links the stored files.
        const attachments = await Promise.all(
          (draft.files ?? []).map(async (file) => {
            const uploadUrl = await generateCommentUploadUrl({});
            const response = await fetch(uploadUrl, {
              method: "POST",
              headers: { "Content-Type": file.type || "application/octet-stream" },
              body: file,
            });
            if (!response.ok) throw new Error(`Uploading ${file.name} failed`);
            const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
            return {
              storageId,
              name: file.name,
              size: file.size,
              type: file.type || "application/octet-stream",
            };
          }),
        );
        await addCommentMutation({
          threadId: threadId as Id<"threads">,
          body: draft.body,
          mentionedUserIds: draft.mentionedUserIds?.map((id) => id as Id<"users">),
          attachments: attachments.length > 0 ? attachments : undefined,
        });
      } catch (error) {
        setOperation("comment", "error", "Your comment could not be posted.");
        toast.error("Your comment could not be posted.", {
          id: TOAST_IDS.comment,
          description: "Your text is preserved — try again.",
        });
        throw error;
      }
      setOperation("comment", "success");
    };

    const simulateEmail = async (inboxId: string) =>
      runMutation(
        "simulate",
        () => simulateMutation({ inboxId: inboxId as Id<"inboxes"> }),
        {
          toastId: TOAST_IDS.simulate,
          successToast: {
            title: "Incoming email delivered",
            description: "Context.dev is generating the sender's company profile.",
          },
          retry: () => void simulateEmail(inboxId).catch(() => undefined),
        },
      );

    const retryLoad = async (scope: LoadScope) => {
      // Queries are reactive and recover on their own; only the seeding
      // step is imperative and needs an explicit retry.
      if (scope === "screen") await runSetup();
    };

    return {
      state,
      selectInbox,
      selectThread,
      assignThread,
      setStatus,
      setUnread,
      setPriority,
      setLabels,
      generateDraft,
      sendReply,
      addComment,
      simulateEmail,
      retryLoad,
    };
  }, [
    state,
    runMutation,
    assignMutation,
    setStatusMutation,
    sendReplyMutation,
    addCommentMutation,
    generateCommentUploadUrl,
    simulateMutation,
    markRead,
    runSetup,
    setOperation,
  ]);

  const railUser = profile
    ? { name: profile.name, imageUrl: profile.imageUrl ?? undefined }
    : undefined;

  // Presence resets when the selected thread changes (keyed reporter), so
  // stale viewers from the previous thread never flash in the header.
  const viewers = useMemo<ThreadViewer[]>(
    () =>
      presence
        .filter((entry) => entry.online)
        .map((entry) => ({
          id: entry.userId,
          name: entry.name ?? "Teammate",
          initials: getInitials(entry.name ?? "Teammate"),
          imageUrl: entry.image,
          isSelf: me !== null && me !== undefined && entry.userId === me._id,
        })),
    [presence, me],
  );

  return (
    <>
      {selectedThreadId && me ? (
        <PresenceReporter
          key={selectedThreadId}
          threadId={selectedThreadId}
          userId={me._id}
          onChange={setPresence}
        />
      ) : null}
      <InboxScreen
        controller={controller}
        currentUser={railUser}
        onSignOut={() => void signOut()}
        viewers={viewers}
      />
    </>
  );
}

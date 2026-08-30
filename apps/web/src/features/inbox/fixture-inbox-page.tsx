import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { INITIAL_OPERATIONS, TOAST_IDS, type FixtureScenario } from "./constants";
import {
  FIXTURE_COMPANIES,
  FIXTURE_INBOXES,
  FIXTURE_MESSAGES,
  FIXTURE_TEAMMATES,
  FIXTURE_THREADS,
  getFixtureDraft,
} from "./fixture-data";
import { InboxScreen } from "./inbox-screen";
import type { InboxController, LoadScope } from "./model";
import type {
  InboxScreenState,
  Message,
  OperationKey,
  ThreadDetail,
  ThreadSummary,
} from "./types";

const LOAD_DELAY_MS = 450;
const MUTATION_DELAY_MS = 350;
const DRAFT_DELAY_MS = 900;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type FixtureInboxPageProps = {
  /** Deterministic scenario, selectable via `?scenario=` in development. */
  scenario?: FixtureScenario;
};

function seedThreads(scenario: FixtureScenario): ThreadSummary[] {
  if (scenario === "empty-inbox") return [];
  if (scenario === "empty-filter") {
    return FIXTURE_THREADS.filter(
      (thread) => thread.inboxId !== "inbox-sales" || thread.status === "open",
    );
  }
  return FIXTURE_THREADS;
}

function initialState(): InboxScreenState {
  return {
    screenStatus: "loading",
    inboxes: [],
    teammates: [],
    selectedInboxId: null,
    selectedThreadId: null,
    listStatus: "idle",
    threads: [],
    threadStatus: "idle",
    selectedThread: null,
    operations: INITIAL_OPERATIONS,
  };
}

/**
 * Fixture-driven controller implementing the `InboxController` seam with
 * seeded local data and simulated latency. The integration developer replaces
 * this page with a Convex-backed implementation of the same interface.
 */
export function FixtureInboxPage({ scenario = "ready" }: FixtureInboxPageProps) {
  const [state, setState] = useState<InboxScreenState>(() => initialState());
  // Scope-level failures trigger once per scenario so Retry recovers to ready.
  const failedOnce = useRef<Set<string>>(new Set());
  const allThreads = useMemo(() => seedThreads(scenario), [scenario]);

  const shouldFail = useCallback(
    (key: string, active: boolean) => {
      if (!active || failedOnce.current.has(key)) return false;
      failedOnce.current.add(key);
      return true;
    },
    [],
  );

  const setOperation = useCallback((key: OperationKey, status: "idle" | "loading" | "success" | "error", message?: string) => {
    setState((prev) => ({
      ...prev,
      operations: { ...prev.operations, [key]: { status, message } },
    }));
  }, []);

  const buildDetail = useCallback(
    (thread: ThreadSummary): ThreadDetail => ({
      thread,
      messages: FIXTURE_MESSAGES[thread.id] ?? [],
      company:
        scenario === "missing-company" ? undefined : FIXTURE_COMPANIES[thread.id],
    }),
    [scenario],
  );

  const loadScreen = useCallback(async () => {
    setState((prev) => ({ ...prev, screenStatus: "loading" }));
    await delay(LOAD_DELAY_MS);
    if (scenario === "loading") return;
    if (shouldFail("screen", scenario === "screen-error")) {
      setState((prev) => ({
        ...prev,
        screenStatus: "error",
        screenError: "Request failed while loading workspace data.",
      }));
      return;
    }
    const selectedInboxId = FIXTURE_INBOXES[0]!.id;
    setState((prev) => ({
      ...prev,
      screenStatus: "ready",
      screenError: undefined,
      inboxes: FIXTURE_INBOXES,
      teammates: FIXTURE_TEAMMATES,
      selectedInboxId,
      listStatus: "loading",
    }));
    await loadList(selectedInboxId);
  }, [scenario, shouldFail]);

  const loadList = useCallback(
    async (inboxId: string) => {
      setState((prev) => ({ ...prev, listStatus: "loading", listError: undefined }));
      await delay(LOAD_DELAY_MS);
      if (scenario === "list-loading") return;
      if (shouldFail(`list:${inboxId}`, scenario === "list-error")) {
        setState((prev) => ({
          ...prev,
          listStatus: "error",
          listError: "Conversations could not load.",
        }));
        return;
      }
      const threads = allThreads.filter((thread) => thread.inboxId === inboxId);
      setState((prev) => ({
        ...prev,
        listStatus: threads.length === 0 ? "empty" : "ready",
        threads,
      }));
    },
    [allThreads, scenario, shouldFail],
  );

  const loadThread = useCallback(
    async (threadId: string) => {
      setState((prev) => ({
        ...prev,
        selectedThreadId: threadId,
        threadStatus: "loading",
        threadError: undefined,
      }));
      await delay(LOAD_DELAY_MS);
      if (scenario === "thread-loading") return;
      if (shouldFail(`thread:${threadId}`, scenario === "thread-error")) {
        setState((prev) => ({
          ...prev,
          threadStatus: "error",
          threadError: "This conversation could not load.",
        }));
        return;
      }
      setState((prev) => {
        const thread = prev.threads.find((item) => item.id === threadId);
        if (!thread) return { ...prev, threadStatus: "error", threadError: "Conversation not found." };
        const readThread = { ...thread, unread: false };
        return {
          ...prev,
          threads: prev.threads.map((item) => (item.id === threadId ? readThread : item)),
          threadStatus: "ready",
          selectedThread: buildDetail(readThread),
        };
      });
    },
    [buildDetail, scenario, shouldFail],
  );

  useEffect(() => {
    failedOnce.current.clear();
    setState(initialState());
    void loadScreen();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when the scenario changes
  }, [scenario]);

  const updateThread = useCallback(
    (threadId: string, patch: Partial<ThreadSummary>) => {
      setState((prev) => {
        const threads = prev.threads.map((thread) =>
          thread.id === threadId ? { ...thread, ...patch } : thread,
        );
        const selectedThread =
          prev.selectedThread && prev.selectedThread.thread.id === threadId
            ? { ...prev.selectedThread, thread: { ...prev.selectedThread.thread, ...patch } }
            : prev.selectedThread;
        return { ...prev, threads, selectedThread };
      });
    },
    [],
  );

  const runMutation = useCallback(
    async (
      key: OperationKey,
      apply: () => void,
      options?: { toastId?: string; successToast?: { title: string; description?: string }; retry?: () => void },
    ) => {
      setOperation(key, "loading");
      await delay(MUTATION_DELAY_MS);
      if (scenario === "mutation-error") {
        setOperation(key, "error", "The change could not be saved.");
        toast.error("The change could not be saved.", {
          id: options?.toastId ?? TOAST_IDS[key as keyof typeof TOAST_IDS] ?? `inbox-${key}`,
          action: options?.retry
            ? { label: "Retry", onClick: options.retry }
            : undefined,
        });
        throw new Error("mutation failed");
      }
      apply();
      setOperation(key, "success");
      if (options?.successToast) {
        toast.success(options.successToast.title, {
          id: options?.toastId ?? `inbox-${key}`,
          description: options.successToast.description,
        });
      }
    },
    [scenario, setOperation],
  );

  const controller = useMemo<InboxController>(() => {
    const selectInbox = (inboxId: string) => {
      setState((prev) => ({
        ...prev,
        selectedInboxId: inboxId,
        selectedThreadId: null,
        selectedThread: null,
        threadStatus: "idle",
      }));
      void loadList(inboxId);
    };

    const selectThread = (threadId: string) => {
      void loadThread(threadId);
    };

    const assignThread = async (threadId: string, teammateId: string) =>
      runMutation("assign", () => updateThread(threadId, { assigneeId: teammateId }), {
        toastId: TOAST_IDS.assign,
        retry: () => void assignThread(threadId, teammateId).catch(() => undefined),
      });

    const setStatus = async (threadId: string, status: ThreadSummary["status"]) =>
      runMutation("status", () => updateThread(threadId, { status }), {
        toastId: TOAST_IDS.status,
        successToast:
          status === "closed" ? { title: "Conversation marked Done." } : undefined,
        retry: () => void setStatus(threadId, status).catch(() => undefined),
      });

    const setUnread = async (threadId: string, unread: boolean) =>
      runMutation("unread", () => updateThread(threadId, { unread }), {
        toastId: TOAST_IDS.unread,
        retry: () => void setUnread(threadId, unread).catch(() => undefined),
      });

    const setPriority = async (threadId: string, priority: ThreadSummary["priority"]) =>
      runMutation("priority", () => updateThread(threadId, { priority }), {
        toastId: TOAST_IDS.priority,
        retry: () => void setPriority(threadId, priority).catch(() => undefined),
      });

    const setLabels = async (threadId: string, labelIds: string[]) =>
      runMutation(
        "labels",
        () => {
          setState((prev) => {
            const resolve = (thread: ThreadSummary) => ({
              ...thread,
              labels: thread.labels.filter((item) => labelIds.includes(item.id)),
            });
            return {
              ...prev,
              threads: prev.threads.map((thread) => (thread.id === threadId ? resolve(thread) : thread)),
              selectedThread:
                prev.selectedThread && prev.selectedThread.thread.id === threadId
                  ? { ...prev.selectedThread, thread: resolve(prev.selectedThread.thread) }
                  : prev.selectedThread,
            };
          });
        },
        { toastId: TOAST_IDS.labels },
      );

    const generateDraft = async (threadId: string) => {
      setOperation("draft", "loading");
      await delay(DRAFT_DELAY_MS);
      if (scenario === "draft-error") {
        setOperation("draft", "error", "Copilot could not draft a reply.");
        throw new Error("draft failed");
      }
      setOperation("draft", "success");
      return getFixtureDraft(threadId);
    };

    const sendReply = async (threadId: string, body: string) => {
      setOperation("send", "loading");
      await delay(MUTATION_DELAY_MS + 250);
      if (scenario === "send-error") {
        setOperation("send", "error", "Your reply could not be sent.");
        toast.error("Your reply could not be sent.", {
          id: TOAST_IDS.send,
          description: "Your draft is preserved — try again.",
        });
        throw new Error("send failed");
      }
      const message: Message = {
        id: `msg-sent-${Date.now()}`,
        threadId,
        direction: "outbound",
        authorName: "You",
        authorEmail: "you@reply.dev",
        body,
        sentAt: Date.now(),
      };
      setState((prev) => {
        const patch = { status: "waiting" as const, preview: body.slice(0, 90), lastActivityAt: message.sentAt };
        const threads = prev.threads.map((thread) =>
          thread.id === threadId ? { ...thread, ...patch } : thread,
        );
        const selectedThread =
          prev.selectedThread && prev.selectedThread.thread.id === threadId
            ? {
                ...prev.selectedThread,
                thread: { ...prev.selectedThread.thread, ...patch },
                messages: [...prev.selectedThread.messages, message],
              }
            : prev.selectedThread;
        return { ...prev, threads, selectedThread };
      });
      setOperation("send", "success");
      toast.success("Reply sent", {
        id: TOAST_IDS.send,
        description: "Conversation moved to Waiting.",
      });
    };

    const retryLoad = async (scope: LoadScope) => {
      if (scope === "screen") return loadScreen();
      if (scope === "list") {
        const inboxId = state.selectedInboxId ?? FIXTURE_INBOXES[0]!.id;
        return loadList(inboxId);
      }
      if (state.selectedThreadId) return loadThread(state.selectedThreadId);
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
      retryLoad,
    };
  }, [loadList, loadScreen, loadThread, runMutation, scenario, setOperation, state, updateThread]);

  return <InboxScreen controller={controller} />;
}

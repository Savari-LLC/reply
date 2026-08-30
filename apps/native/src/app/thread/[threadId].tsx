import { api } from "@reply/backend/convex/_generated/api";
import type { Id } from "@reply/backend/convex/_generated/dataModel";
import { usePresence } from "@convex-dev/presence/react-native";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { LabelPill, StatusPill, UrgentPill } from "@/components/pills";
import { CenteredLoading, CenteredState } from "@/components/screen-states";
import {
  formatClockTime,
  formatDateSeparator,
  formatRelativeTime,
  getAvatarTint,
  getInitials,
  isSameDay,
} from "@/lib/format";
import { STATUS_LABELS, colors, type ThreadStatus } from "@/theme";

type ThreadDetail = NonNullable<FunctionReturnType<typeof api.inbox.getThread>>;
type ThreadMessage = ThreadDetail["messages"][number];
type ThreadComment = ThreadDetail["comments"][number];
type Teammate = NonNullable<
  FunctionReturnType<typeof api.inbox.listTeammates>
>[number];

type TimelineEntry =
  | { kind: "message"; sentAt: number; message: ThreadMessage }
  | { kind: "comment"; sentAt: number; comment: ThreadComment };

type ComposerMode = "reply" | "comment";
type CopilotStatus = "idle" | "loading" | "error";
type CopilotMode = "draft" | "grammar" | "improve";

const COPILOT_WORKING: Record<CopilotMode, string> = {
  draft: "Drafting…",
  grammar: "Fixing grammar…",
  improve: "Improving…",
};

const COPILOT_FAILED: Record<CopilotMode, string> = {
  draft: "Copilot couldn't draft — retry",
  grammar: "Copilot couldn't fix grammar — retry",
  improve: "Copilot couldn't improve it — retry",
};

/**
 * Finds the "@query" the caret is inside, if any: the last "@" before the
 * caret that starts a word, with no newline between it and the caret.
 * Mirrors the web app's comment composer.
 */
function activeMentionQuery(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  const upToCaret = text.slice(0, caret);
  const at = upToCaret.lastIndexOf("@");
  if (at === -1) return null;
  if (at > 0 && !/\s/.test(upToCaret[at - 1]!)) return null;
  const query = upToCaret.slice(at + 1);
  if (query.includes("\n") || query.length > 40) return null;
  return { start: at, query };
}

export default function ThreadScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const insets = useSafeAreaInsets();
  const detail = useQuery(api.inbox.getThread, { threadId });
  const teammates = useQuery(api.inbox.listTeammates, {});
  const me = useQuery(api.users.getCurrent);

  const markRead = useMutation(api.inbox.markRead);
  const setStatus = useMutation(api.inbox.setStatus);
  const setPriority = useMutation(api.inbox.setPriority);
  const assign = useMutation(api.inbox.assign);
  const sendReply = useMutation(api.inbox.sendReply);
  const addComment = useMutation(api.inbox.addComment);
  const generateDraft = useAction(api.copilot.generateDraft);

  const [mode, setMode] = useState<ComposerMode>("reply");
  const [draft, setDraft] = useState("");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [copilotStatus, setCopilotStatus] = useState<CopilotStatus>("idle");
  const [copilotMode, setCopilotMode] = useState<CopilotMode>("draft");
  const scrollRef = useRef<ScrollView>(null);

  // Opening an unread conversation marks it read for the current user.
  const detailId = detail?._id;
  const detailUnread = detail?.unread;
  useEffect(() => {
    if (detailId && detailUnread) {
      markRead({ threadId: detailId }).catch(() => {});
    }
  }, [detailId, detailUnread, markRead]);

  function changeStatus(status: ThreadStatus) {
    if (!detail || detail.status === status) return;
    setStatus({ threadId: detail._id, status })
      .then(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      )
      .catch(() => Alert.alert("The change could not be saved."));
  }

  function assignTo(teammateId: Id<"users"> | null) {
    if (!detail) return;
    assign({ threadId: detail._id, teammateId })
      .then(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      )
      .catch(() => Alert.alert("The change could not be saved."));
  }

  function openAssignSheet(rows: Teammate[]) {
    if (!detail) return;
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: "Assign this conversation",
        options: ["Cancel", "Unassigned", ...rows.map((t) => t.name)],
        cancelButtonIndex: 0,
      },
      (index) => {
        if (index === 0) return;
        if (index === 1) {
          assignTo(null);
          return;
        }
        const teammate = rows[index - 2];
        if (teammate) assignTo(teammate._id);
      },
    );
  }

  function toggleUrgent() {
    if (!detail) return;
    const priority = detail.priority === "urgent" ? "normal" : "urgent";
    setPriority({ threadId: detail._id, priority })
      .then(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      )
      .catch(() => Alert.alert("The change could not be saved."));
  }

  function openActionsSheet() {
    if (!detail) return;
    const urgentLabel =
      detail.priority === "urgent" ? "Remove urgent" : "Mark urgent";
    const statusActions = (["open", "waiting", "closed"] as const)
      .filter((status) => status !== detail.status)
      .map((status) => ({ label: `Mark as ${STATUS_LABELS[status]}`, status }));
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: detail.subject,
        options: [
          "Cancel",
          "Assign to…",
          urgentLabel,
          ...statusActions.map((a) => a.label),
        ],
        cancelButtonIndex: 0,
      },
      (index) => {
        if (index === 0) return;
        if (index === 1) {
          openAssignSheet(teammates ?? []);
          return;
        }
        if (index === 2) {
          toggleUrgent();
          return;
        }
        const action = statusActions[index - 3];
        if (action) changeStatus(action.status);
      },
    );
  }

  async function runCopilot(copilotMode: CopilotMode) {
    if (!detail || copilotStatus === "loading") return;
    setCopilotStatus("loading");
    setCopilotMode(copilotMode);
    try {
      const generated = await generateDraft({
        threadId: detail._id,
        currentDraft: draft.trim().length > 0 ? draft : undefined,
        mode: copilotMode,
      });
      setDraft(generated);
      setCopilotStatus("idle");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setCopilotStatus("error");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  function openCopilotMenu() {
    if (copilotStatus === "loading") return;
    const hasText = draft.trim().length > 0;
    const actions: Array<{ label: string; mode: CopilotMode }> = [
      { label: "Draft reply", mode: "draft" },
      ...(hasText
        ? [
            { label: "Fix grammar", mode: "grammar" as const },
            { label: "Improve writing", mode: "improve" as const },
          ]
        : []),
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: "Copilot",
        message: hasText
          ? "Work with your current draft or start fresh."
          : "Write a reply from the thread and company context.",
        options: ["Cancel", ...actions.map((action) => action.label)],
        cancelButtonIndex: 0,
      },
      (index) => {
        if (index === 0) return;
        const action = actions[index - 1];
        if (action) void runCopilot(action.mode);
      },
    );
  }

  async function handleSend() {
    if (!detail || sending) return;
    const isReply = mode === "reply";
    const body = (isReply ? draft : comment).trim();
    if (body.length === 0) return;
    setSending(true);
    try {
      if (isReply) {
        await sendReply({ threadId: detail._id, body });
        setDraft("");
      } else {
        await addComment({ threadId: detail._id, body });
        setComment("");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      requestAnimationFrame(() =>
        scrollRef.current?.scrollToEnd({ animated: true }),
      );
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        isReply ? "Your reply could not be sent" : "Your comment could not be posted",
        "Your draft is preserved — try again.",
      );
    } finally {
      setSending(false);
    }
  }

  let body;
  if (detail === undefined) {
    body = <CenteredLoading label="Loading conversation…" />;
  } else if (detail === null) {
    body = (
      <CenteredState
        symbol="exclamationmark.triangle"
        title="This conversation could not load"
        message="It may have been removed, or you no longer have access."
      />
    );
  } else {
    body = (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top + 44}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="automatic"
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: false })
          }
        >
          <SubjectHeader detail={detail}>
            {me ? (
              <ViewersPill threadId={detail._id} meId={me._id} />
            ) : null}
          </SubjectHeader>
          <CompanyCard detail={detail} />
          <Timeline detail={detail} />
        </ScrollView>
        <Composer
          mode={mode}
          onModeChange={setMode}
          draft={draft}
          comment={comment}
          onChangeDraft={setDraft}
          onChangeComment={setComment}
          sending={sending}
          copilotStatus={copilotStatus}
          copilotMode={copilotMode}
          onCopilot={openCopilotMenu}
          onSend={handleSend}
        />
      </KeyboardAvoidingView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: detail?.senderName ?? "",
          headerBackTitle: "Back",
          headerRight: detail
            ? () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Conversation actions"
                  testID="thread-actions"
                  onPress={openActionsSheet}
                  hitSlop={8}
                >
                  <SymbolView
                    name="ellipsis.circle"
                    size={22}
                    tintColor={colors.primaryText}
                  />
                </Pressable>
              )
            : undefined,
        }}
      />
      {body}
    </>
  );
}

function SubjectHeader({
  detail,
  children,
}: {
  detail: ThreadDetail;
  children?: ReactNode;
}) {
  return (
    <View style={styles.subjectHeader}>
      <Text style={styles.subjectText}>{detail.subject}</Text>
      <View style={styles.subjectMeta}>
        <View style={styles.inboxPill}>
          <SymbolView name="tray" size={10} tintColor={colors.textSubtle} />
          <Text style={styles.inboxPillText}>{detail.inboxName}</Text>
        </View>
        <StatusPill status={detail.status} />
        {detail.priority === "urgent" ? <UrgentPill /> : null}
        {detail.labels.map((label) => (
          <LabelPill key={label.name} name={label.name} color={label.color} />
        ))}
        {detail.assignee ? (
          <Text style={styles.assigneeText}>
            Assigned to {detail.assignee.name}
          </Text>
        ) : null}
        {children}
      </View>
    </View>
  );
}

/** Live "Viewing" pill showing teammates currently on this thread. */
function ViewersPill({ threadId, meId }: { threadId: string; meId: string }) {
  const state = usePresence(api.presence, threadId, meId) as
    | Array<{
        userId: string;
        online: boolean;
        name?: string;
        image?: string;
      }>
    | undefined;
  const viewers = (state ?? []).filter(
    (entry) => entry.online && entry.userId !== meId,
  );
  if (viewers.length === 0) return null;
  const shown = viewers.slice(0, 3);
  const overflow = viewers.length - shown.length;
  return (
    <View
      style={styles.viewersPill}
      accessibilityLabel={`Viewing: ${viewers
        .map((viewer) => viewer.name ?? "Teammate")
        .join(", ")}`}
    >
      <View style={styles.viewersDot} />
      <Text style={styles.viewersText}>Viewing</Text>
      <View style={styles.viewersAvatars}>
        {shown.map((viewer, index) => (
          <View
            key={viewer.userId}
            style={[styles.viewerAvatar, index > 0 && styles.viewerOverlap]}
          >
            <Avatar
              name={viewer.name ?? "Teammate"}
              imageUrl={viewer.image}
              size={22}
            />
          </View>
        ))}
        {overflow > 0 ? (
          <View style={[styles.viewerAvatar, styles.viewerOverlap, styles.viewerOverflow]}>
            <Text style={styles.viewerOverflowText}>+{overflow}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function CompanyCard({ detail }: { detail: ThreadDetail }) {
  const profile = detail.companyProfile;
  if (!profile) {
    return (
      <View style={styles.companyCard}>
        <ActivityIndicator size="small" color={colors.textMuted} />
        <Text style={styles.companyPendingText}>
          Generating a company profile for {detail.senderDomain} with Context.dev…
        </Text>
      </View>
    );
  }
  const metaLine = [profile.industry, profile.location]
    .filter(Boolean)
    .join(" · ");
  return (
    <View style={styles.companyCard}>
      {profile.logoUrl ? (
        <Image
          source={{ uri: profile.logoUrl }}
          style={[styles.companyLogo, styles.companyLogoImage]}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View
          style={[
            styles.companyLogo,
            { backgroundColor: getAvatarTint(profile.name) },
          ]}
        >
          <Text style={styles.companyInitials}>{getInitials(profile.name)}</Text>
        </View>
      )}
      <View style={styles.companyBody}>
        <View style={styles.companyTitleRow}>
          <Text style={styles.companyName} numberOfLines={1}>
            {profile.name}
          </Text>
          <Text style={styles.companyDomain} numberOfLines={1}>
            {detail.senderDomain}
          </Text>
        </View>
        {profile.description ? (
          <Text style={styles.companyDescription} numberOfLines={3}>
            {profile.description}
          </Text>
        ) : null}
        {metaLine.length > 0 ? (
          <Text style={styles.companyMeta} numberOfLines={1}>
            {metaLine}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Timeline({ detail }: { detail: ThreadDetail }) {
  const entries: TimelineEntry[] = [
    ...detail.messages.map((message) => ({
      kind: "message" as const,
      sentAt: message.sentAt,
      message,
    })),
    ...detail.comments.map((comment) => ({
      kind: "comment" as const,
      sentAt: comment.sentAt,
      comment,
    })),
  ].sort((a, b) => a.sentAt - b.sentAt);

  const items: ReactNode[] = [];
  let previous: TimelineEntry | null = null;
  for (const entry of entries) {
    const key = entry.kind === "message" ? entry.message._id : entry.comment._id;
    if (!previous || !isSameDay(previous.sentAt, entry.sentAt)) {
      items.push(
        <View key={`sep-${key}`} style={styles.dateSeparatorRow}>
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>
              {formatDateSeparator(entry.sentAt)}
            </Text>
          </View>
        </View>,
      );
    }
    if (entry.kind === "message") {
      items.push(
        entry.message.direction === "inbound" ? (
          <InboundCard key={key} message={entry.message} detail={detail} />
        ) : (
          <OutboundCard key={key} message={entry.message} detail={detail} />
        ),
      );
    } else {
      const grouped =
        previous?.kind === "comment" &&
        previous.comment.authorId === entry.comment.authorId &&
        isSameDay(previous.sentAt, entry.sentAt);
      items.push(
        <CommentBubble key={key} comment={entry.comment} grouped={grouped} />,
      );
    }
    previous = entry;
  }
  return <View style={styles.timeline}>{items}</View>;
}

function InboundCard({
  message,
  detail,
}: {
  message: ThreadMessage;
  detail: ThreadDetail;
}) {
  const authorName = message.senderName ?? detail.senderName;
  return (
    <View style={styles.emailCard}>
      <View style={styles.emailHeader}>
        <Avatar name={authorName} size={30} online />
        <View style={styles.emailHeaderText}>
          <Text style={styles.emailAuthor} numberOfLines={1}>
            {authorName}
          </Text>
          <Text style={styles.emailAddress} numberOfLines={1}>
            {detail.senderEmail}
          </Text>
        </View>
        <Text style={styles.emailTime}>{formatRelativeTime(message.sentAt)}</Text>
      </View>
      <Text style={styles.emailBody}>{message.body}</Text>
    </View>
  );
}

function OutboundCard({
  message,
  detail,
}: {
  message: ThreadMessage;
  detail: ThreadDetail;
}) {
  const authorName = message.author ?? "Teammate";
  return (
    <View style={styles.emailCard}>
      <View style={styles.emailHeader}>
        <Avatar
          name={authorName}
          imageUrl={message.authorImageUrl ?? undefined}
          size={30}
        />
        <View style={styles.emailHeaderText}>
          <Text style={styles.emailAuthor} numberOfLines={1}>
            {authorName}
          </Text>
          <Text style={styles.emailAddress} numberOfLines={1}>
            To: {detail.senderEmail}
          </Text>
        </View>
        <View style={styles.sentReplyPill}>
          <SymbolView
            name="arrowshape.turn.up.left"
            size={10}
            tintColor={colors.textMuted}
          />
          <Text style={styles.sentReplyText}>Sent reply</Text>
        </View>
        <Text style={styles.emailTime}>{formatClockTime(message.sentAt)}</Text>
      </View>
      <Text style={styles.emailBody}>{message.body}</Text>
    </View>
  );
}

/** Renders a comment body with `@Name` mention tokens highlighted. */
function CommentBody({ comment }: { comment: ThreadComment }) {
  const names = comment.mentions.map((mention) => mention.name).filter(Boolean);
  if (names.length === 0) {
    return <Text style={styles.commentBody}>{comment.body}</Text>;
  }
  const pattern = new RegExp(
    `(${names.map((name) => `@${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).join("|")})`,
    "g",
  );
  const parts = comment.body.split(pattern);
  return (
    <Text style={styles.commentBody}>
      {parts.map((part, index) =>
        pattern.test(part) ? (
          <Text key={index} style={styles.mention}>
            {part}
          </Text>
        ) : (
          <Text key={index}>{part}</Text>
        ),
      )}
    </Text>
  );
}

function CommentBubble({
  comment,
  grouped,
}: {
  comment: ThreadComment;
  grouped: boolean;
}) {
  const images = comment.attachments.filter((a) => a.type.startsWith("image/"));
  const files = comment.attachments.filter((a) => !a.type.startsWith("image/"));
  return (
    <View style={styles.commentWrap}>
      {!grouped ? (
        <View style={styles.commentAuthorRow}>
          <Avatar
            name={comment.authorName}
            imageUrl={comment.authorImageUrl ?? undefined}
            size={24}
          />
          <Text style={styles.commentAuthor}>{comment.authorName}</Text>
          <Text style={styles.commentKind}>Internal comment</Text>
          <Text style={styles.commentTime}>
            {formatClockTime(comment.sentAt)}
          </Text>
        </View>
      ) : null}
      <View style={styles.commentBubble}>
        <CommentBody comment={comment} />
        {images.map((attachment) => (
          <Image
            key={attachment.url}
            source={{ uri: attachment.url }}
            style={styles.commentImage}
            contentFit="cover"
            accessibilityIgnoresInvertColors
            accessibilityLabel={attachment.name}
          />
        ))}
        {files.map((attachment) => (
          <View key={attachment.url} style={styles.commentFile}>
            <SymbolView
              name="doc.text"
              size={13}
              tintColor={colors.textSubtle}
            />
            <Text style={styles.commentFileName} numberOfLines={1}>
              {attachment.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Composer({
  mode,
  onModeChange,
  draft,
  comment,
  onChangeDraft,
  onChangeComment,
  sending,
  copilotStatus,
  copilotMode,
  onCopilot,
  onSend,
}: {
  mode: ComposerMode;
  onModeChange: (mode: ComposerMode) => void;
  draft: string;
  comment: string;
  onChangeDraft: (value: string) => void;
  onChangeComment: (value: string) => void;
  sending: boolean;
  copilotStatus: CopilotStatus;
  copilotMode: CopilotMode;
  onCopilot: () => void;
  onSend: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isReply = mode === "reply";
  const value = isReply ? draft : comment;
  const canSend = value.trim().length > 0 && !sending && copilotStatus !== "loading";
  return (
    <View
      style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 8) }]}
    >
      <View style={styles.composerModes} accessibilityRole="tablist">
        {(["reply", "comment"] as const).map((item) => {
          const selected = item === mode;
          return (
            <Pressable
              key={item}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              testID={`composer-mode-${item}`}
              onPress={() => onModeChange(item)}
              style={[styles.modeChip, selected && styles.modeChipSelected]}
            >
              <Text
                style={[styles.modeChipText, selected && styles.modeChipTextSelected]}
              >
                {item === "reply" ? "Reply" : "Comment"}
              </Text>
            </Pressable>
          );
        })}
        {isReply ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Copilot writing tools"
            accessibilityState={{ busy: copilotStatus === "loading" }}
            testID="copilot-button"
            onPress={onCopilot}
            disabled={copilotStatus === "loading" || sending}
            style={styles.copilotButton}
            hitSlop={6}
          >
            {copilotStatus === "loading" ? (
              <ActivityIndicator size="small" color={colors.primaryText} />
            ) : (
              <SymbolView
                name="sparkles"
                size={14}
                tintColor={
                  copilotStatus === "error" ? colors.destructive : colors.primaryText
                }
              />
            )}
            <Text
              style={[
                styles.copilotText,
                copilotStatus === "error" && styles.copilotErrorText,
              ]}
            >
              {copilotStatus === "loading"
                ? COPILOT_WORKING[copilotMode]
                : copilotStatus === "error"
                  ? COPILOT_FAILED[copilotMode]
                  : "Copilot"}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.composerRow}>
        <TextInput
          style={[styles.composerInput, !isReply && styles.composerInputComment]}
          placeholder={
            isReply
              ? "Write a reply…"
              : "Add internal comment — visible to your team only…"
          }
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={isReply ? onChangeDraft : onChangeComment}
          multiline
          editable={!sending}
          accessibilityLabel={isReply ? "Reply message" : "Internal comment"}
          testID="composer-input"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isReply ? "Send reply" : "Post comment"}
          accessibilityState={{ disabled: !canSend, busy: sending }}
          testID="send-button"
          onPress={onSend}
          disabled={!canSend}
          hitSlop={6}
          style={styles.sendButton}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <SymbolView
              name={isReply ? "arrow.up.circle.fill" : "text.bubble.fill"}
              size={30}
              tintColor={canSend ? colors.primary : colors.border}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  subjectHeader: {
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  subjectText: {
    fontSize: 19,
    fontWeight: "600",
    color: colors.textStrong,
    letterSpacing: -0.4,
    lineHeight: 24,
  },
  subjectMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  inboxPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: colors.hover,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  inboxPillText: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.textSubtle,
  },
  assigneeText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  viewersPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  viewersDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  viewersText: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.textMuted,
  },
  viewersAvatars: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewerAvatar: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.surfaceElevated,
  },
  viewerOverlap: {
    marginLeft: -7,
  },
  viewerOverflow: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.active,
    alignItems: "center",
    justifyContent: "center",
  },
  viewerOverflowText: {
    fontSize: 9,
    fontWeight: "600",
    color: colors.textSubtle,
  },
  companyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 12,
  },
  companyPendingText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  companyLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  companyLogoImage: {
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  companyInitials: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  companyBody: {
    flex: 1,
    gap: 2,
  },
  companyTitleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  companyName: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.textStrong,
    letterSpacing: -0.2,
  },
  companyDomain: {
    fontSize: 12,
    color: colors.primaryText,
  },
  companyDescription: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  companyMeta: {
    fontSize: 11,
    color: colors.textSubtle,
    marginTop: 2,
  },
  timeline: {
    gap: 12,
    paddingTop: 14,
  },
  dateSeparatorRow: {
    alignItems: "center",
    paddingVertical: 2,
  },
  dateSeparator: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.hover,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  dateSeparatorText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  emailCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  emailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  emailHeaderText: {
    flex: 1,
  },
  emailAuthor: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textStrong,
    letterSpacing: -0.2,
  },
  emailAddress: {
    fontSize: 12,
    color: colors.textMuted,
  },
  emailTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  sentReplyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: colors.hover,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sentReplyText: {
    fontSize: 10,
    fontWeight: "500",
    color: colors.textMuted,
  },
  emailBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  commentWrap: {
    gap: 4,
  },
  commentAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textStrong,
  },
  commentKind: {
    fontSize: 12,
    color: colors.textMuted,
  },
  commentTime: {
    marginLeft: "auto",
    fontSize: 11,
    color: colors.textMuted,
  },
  commentBubble: {
    alignSelf: "flex-start",
    maxWidth: "88%",
    marginLeft: 31,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.hover,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
  },
  commentBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  mention: {
    color: colors.primaryText,
    backgroundColor: colors.active,
    fontWeight: "500",
  },
  commentImage: {
    width: 200,
    height: 130,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  commentFile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  commentFileName: {
    flexShrink: 1,
    fontSize: 12,
    color: colors.textSubtle,
  },
  composer: {
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  composerModes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modeChip: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 4,
    backgroundColor: colors.active,
  },
  modeChipSelected: {
    backgroundColor: colors.brandDark,
  },
  modeChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.textSubtle,
  },
  modeChipTextSelected: {
    color: "#ffffff",
  },
  copilotButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginLeft: "auto",
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  copilotText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primaryText,
  },
  copilotErrorText: {
    color: colors.destructive,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  composerInput: {
    flex: 1,
    minHeight: 38,
    maxHeight: 120,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
    fontSize: 15,
    color: colors.textStrong,
  },
  composerInputComment: {
    backgroundColor: colors.hover,
  },
  sendButton: {
    height: 38,
    width: 34,
    alignItems: "center",
    justifyContent: "center",
  },
});

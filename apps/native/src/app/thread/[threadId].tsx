import { api } from "@reply/backend/convex/_generated/api";
import type { Id } from "@reply/backend/convex/_generated/dataModel";
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
type Teammate = NonNullable<
  FunctionReturnType<typeof api.inbox.listTeammates>
>[number];

type EnrichedCompany = {
  name: string;
  domain: string;
  description?: string;
  logoUrl?: string;
};

export default function ThreadScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const insets = useSafeAreaInsets();
  const detail = useQuery(api.inbox.getThread, { threadId });
  const teammates = useQuery(api.inbox.listTeammates, {});

  const markRead = useMutation(api.inbox.markRead);
  const setStatus = useMutation(api.inbox.setStatus);
  const assign = useMutation(api.inbox.assign);
  const sendReply = useMutation(api.inbox.sendReply);
  const retrieveCompany = useAction(api.contextPreview.retrieveCompany);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Opening an unread conversation marks it read for the current user.
  const detailId = detail?._id;
  const detailUnread = detail?.unread;
  useEffect(() => {
    if (detailId && detailUnread) {
      markRead({ threadId: detailId }).catch(() => {});
    }
  }, [detailId, detailUnread, markRead]);

  // Live Context.dev enrichment for domains without a stored company profile.
  const [enriched, setEnriched] = useState<
    Record<string, EnrichedCompany | null>
  >({});
  const requestedDomains = useRef<Set<string>>(new Set());
  const missingDomain =
    detail && !detail.companyProfile ? detail.senderDomain : null;
  useEffect(() => {
    if (!missingDomain || requestedDomains.current.has(missingDomain)) return;
    requestedDomains.current.add(missingDomain);
    retrieveCompany({ domain: missingDomain })
      .then((company) => {
        setEnriched((previous) => ({
          ...previous,
          [missingDomain]: company
            ? {
                name: company.name ?? company.domain,
                domain: company.domain,
                description: company.description ?? undefined,
                logoUrl: company.logoUrl ?? undefined,
              }
            : null,
        }));
      })
      .catch(() => {
        setEnriched((previous) => ({ ...previous, [missingDomain]: null }));
      });
  }, [missingDomain, retrieveCompany]);

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
    const names = rows.map((teammate) => teammate.name);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: "Assign this conversation",
        options: ["Cancel", "Unassigned", ...names],
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

  function openActionsSheet() {
    if (!detail) return;
    const statusActions: Array<{ label: string; status: ThreadStatus }> = (
      ["open", "waiting", "closed"] as const
    )
      .filter((status) => status !== detail.status)
      .map((status) => ({
        label: `Mark as ${STATUS_LABELS[status]}`,
        status,
      }));
    const options = [
      "Cancel",
      "Assign to…",
      ...statusActions.map((action) => action.label),
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: detail.subject,
        options,
        cancelButtonIndex: 0,
      },
      (index) => {
        if (index === 0) return;
        if (index === 1) {
          openAssignSheet(teammates ?? []);
          return;
        }
        const action = statusActions[index - 2];
        if (action) changeStatus(action.status);
      },
    );
  }

  async function handleSend() {
    if (!detail || sending) return;
    const body = draft.trim();
    if (body.length === 0) return;
    setSending(true);
    try {
      await sendReply({ threadId: detail._id, body });
      setDraft("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Your reply could not be sent",
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
    const company: EnrichedCompany | null | undefined = detail.companyProfile
      ? {
          name: detail.companyProfile.name,
          domain: detail.senderDomain,
          description: detail.companyProfile.description ?? undefined,
          logoUrl: detail.companyProfile.logoUrl ?? undefined,
        }
      : enriched[detail.senderDomain];

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
          <SubjectHeader detail={detail} />
          <CompanyCard
            company={company}
            fallbackName={detail.senderName}
            domain={detail.senderDomain}
          />
          <MessageTimeline detail={detail} />
        </ScrollView>
        <Composer
          draft={draft}
          sending={sending}
          onChange={setDraft}
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

function SubjectHeader({ detail }: { detail: ThreadDetail }) {
  return (
    <View style={styles.subjectHeader}>
      <Text style={styles.subjectText}>{detail.subject}</Text>
      <View style={styles.subjectMeta}>
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
      </View>
    </View>
  );
}

function CompanyCard({
  company,
  fallbackName,
  domain,
}: {
  company: EnrichedCompany | null | undefined;
  fallbackName: string;
  domain: string;
}) {
  if (company === undefined) {
    return (
      <View style={styles.companyCard}>
        <ActivityIndicator size="small" color={colors.textMuted} />
        <Text style={styles.companyPendingText}>
          Looking up {domain} with Context.dev…
        </Text>
      </View>
    );
  }
  const name = company?.name ?? fallbackName;
  return (
    <View style={styles.companyCard}>
      {company?.logoUrl ? (
        <Image
          source={{ uri: company.logoUrl }}
          style={styles.companyLogo}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View
          style={[styles.companyLogo, { backgroundColor: getAvatarTint(name) }]}
        >
          <Text style={styles.companyInitials}>{getInitials(name)}</Text>
        </View>
      )}
      <View style={styles.companyBody}>
        <View style={styles.companyTitleRow}>
          <Text style={styles.companyName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.companyDomain} numberOfLines={1}>
            {domain}
          </Text>
        </View>
        <Text style={styles.companyDescription} numberOfLines={3}>
          {company?.description ?? "Company details are unavailable."}
        </Text>
      </View>
    </View>
  );
}

function MessageTimeline({ detail }: { detail: ThreadDetail }) {
  const items: ReactNode[] = [];
  let previous: ThreadMessage | null = null;
  for (const message of detail.messages) {
    if (!previous || !isSameDay(previous.sentAt, message.sentAt)) {
      items.push(
        <View key={`sep-${message._id}`} style={styles.dateSeparatorRow}>
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>
              {formatDateSeparator(message.sentAt)}
            </Text>
          </View>
        </View>,
      );
    }
    if (message.direction === "inbound") {
      items.push(
        <InboundCard key={message._id} message={message} detail={detail} />,
      );
    } else {
      const showAuthor =
        !previous ||
        previous.direction !== "outbound" ||
        previous.author !== message.author;
      items.push(
        <OutboundBubble
          key={message._id}
          message={message}
          showAuthor={showAuthor}
        />,
      );
    }
    previous = message;
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
    <View style={styles.inboundCard}>
      <View style={styles.inboundHeader}>
        <Avatar name={authorName} size={30} online />
        <View style={styles.inboundHeaderText}>
          <Text style={styles.inboundAuthor} numberOfLines={1}>
            {authorName}
          </Text>
          <Text style={styles.inboundEmail} numberOfLines={1}>
            {detail.senderEmail}
          </Text>
        </View>
        <Text style={styles.inboundTime}>
          {formatRelativeTime(message.sentAt)}
        </Text>
      </View>
      <Text style={styles.inboundBody}>{message.body}</Text>
    </View>
  );
}

function OutboundBubble({
  message,
  showAuthor,
}: {
  message: ThreadMessage;
  showAuthor: boolean;
}) {
  return (
    <View style={styles.outboundWrap}>
      {showAuthor ? (
        <Text style={styles.outboundAuthor}>{message.author ?? "Teammate"}</Text>
      ) : null}
      <View style={styles.outboundBubble}>
        <Text style={styles.outboundBody}>{message.body}</Text>
        <View style={styles.outboundTimePill}>
          <Text style={styles.outboundTimeText}>
            {formatClockTime(message.sentAt)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function Composer({
  draft,
  sending,
  onChange,
  onSend,
}: {
  draft: string;
  sending: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
}) {
  const insets = useSafeAreaInsets();
  const canSend = draft.trim().length > 0 && !sending;
  return (
    <View
      style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 8) }]}
    >
      <TextInput
        style={styles.composerInput}
        placeholder="Write a reply…"
        placeholderTextColor={colors.textMuted}
        value={draft}
        onChangeText={onChange}
        multiline
        editable={!sending}
        accessibilityLabel="Reply message"
        testID="reply-input"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send reply"
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
            name="arrow.up.circle.fill"
            size={30}
            tintColor={canSend ? colors.primary : colors.border}
          />
        )}
      </Pressable>
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
  assigneeText: {
    fontSize: 11,
    color: colors.textMuted,
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
  },
  companyLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
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
  inboundCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  inboundHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  inboundHeaderText: {
    flex: 1,
  },
  inboundAuthor: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textStrong,
    letterSpacing: -0.2,
  },
  inboundEmail: {
    fontSize: 12,
    color: colors.textMuted,
  },
  inboundTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  inboundBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  outboundWrap: {
    alignItems: "flex-end",
    gap: 4,
  },
  outboundAuthor: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSubtle,
    marginRight: 4,
  },
  outboundBubble: {
    maxWidth: "78%",
    backgroundColor: colors.primary,
    borderRadius: 16,
    borderBottomRightRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  outboundBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textInverse,
  },
  outboundTimePill: {
    alignSelf: "flex-end",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  outboundTimeText: {
    fontSize: 10,
    color: "rgba(250,250,250,0.9)",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
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
  sendButton: {
    height: 38,
    width: 34,
    alignItems: "center",
    justifyContent: "center",
  },
});

import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@reply/backend/convex/_generated/api";
import type { Id } from "@reply/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Avatar } from "@/components/avatar";
import { LabelPill, UrgentPill } from "@/components/pills";
import { CenteredLoading, CenteredState } from "@/components/screen-states";
import { formatRelativeTime, getInitials } from "@/lib/format";
import { useInboxSelection } from "@/lib/inbox-selection";
import { STATUS_LABELS, colors, type ThreadStatus } from "@/theme";

type ThreadRow = NonNullable<
  FunctionReturnType<typeof api.inbox.listThreads>
>[number];

type Filter = "all" | ThreadStatus;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "open", label: STATUS_LABELS.open },
  { key: "waiting", label: STATUS_LABELS.waiting },
  { key: "closed", label: STATUS_LABELS.closed },
];

export default function InboxScreen() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { selected, select } = useInboxSelection();
  const currentUser = useQuery(api.users.getCurrent);
  const workspace = useQuery(api.workspaces.getCurrent);
  const inboxes = useQuery(api.inbox.listInboxes, workspace ? {} : "skip");
  const ensureSetup = useMutation(api.inbox.ensureSetup);
  const simulateEmail = useMutation(api.simulate.simulateIncomingEmail);
  const [filter, setFilter] = useState<Filter>("all");
  const [simulating, setSimulating] = useState(false);

  // Idempotent per-session setup, mirroring the web app.
  const setupRan = useRef(false);
  useEffect(() => {
    if (workspace && !setupRan.current) {
      setupRan.current = true;
      ensureSetup({}).catch(() => {
        setupRan.current = false;
      });
    }
  }, [workspace, ensureSetup]);

  // Land on the personal inbox once mailboxes load.
  useEffect(() => {
    if (!selected && inboxes && inboxes.length > 0) {
      const personal = inboxes.find((inbox) => inbox.kind === "personal");
      const first = personal ?? inboxes[0]!;
      select({ id: first._id, name: first.name, kind: first.kind });
    }
  }, [inboxes, selected, select]);

  const threads = useQuery(
    api.inbox.listThreads,
    selected ? { inboxId: selected.id as Id<"inboxes"> } : "skip",
  );

  const filtered = useMemo(() => {
    if (!threads) return [];
    if (filter === "all") return threads;
    return threads.filter((thread) => thread.status === filter);
  }, [threads, filter]);

  const userName = currentUser?.name ?? currentUser?.username ?? "Signed in";
  const userImage = currentUser?.image ?? undefined;

  function confirmSignOut() {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: `Signed in as ${userName}`,
          options: ["Cancel", "Sign Out"],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 1,
        },
        (index) => {
          if (index === 1) void signOut();
        },
      );
    } else {
      void signOut();
    }
  }

  async function handleSimulate() {
    if (!selected || simulating) return;
    setSimulating(true);
    try {
      await simulateEmail({ inboxId: selected.id as Id<"inboxes"> });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Could not simulate an email right now.");
    } finally {
      setSimulating(false);
    }
  }

  const headerLeft = () => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Switch mailbox"
      testID="sidebar-button"
      onPress={() => router.push("/mailboxes")}
      hitSlop={8}
    >
      <SymbolView
        name="sidebar.left"
        size={22}
        tintColor={colors.textStrong}
      />
    </Pressable>
  );

  const headerRight = () => (
    <View style={styles.headerRight}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Simulate incoming email"
        accessibilityState={{ busy: simulating }}
        testID="simulate-button"
        onPress={handleSimulate}
        disabled={simulating}
        hitSlop={8}
        style={simulating && styles.dimmed}
      >
        <SymbolView
          name="envelope.badge"
          size={21}
          tintColor={colors.primaryText}
        />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Account, signed in as ${userName}`}
        onPress={confirmSignOut}
        hitSlop={8}
      >
        <Avatar name={userName} imageUrl={userImage} size={29} online />
      </Pressable>
    </View>
  );

  let body;
  if (workspace === undefined || (workspace && (!selected || threads === undefined))) {
    body = <CenteredLoading label="Loading your inbox…" />;
  } else if (workspace === null) {
    body = (
      <CenteredState
        symbol="rectangle.stack.badge.person.crop"
        title="Finish setup on the web"
        message="Your account isn't part of a workspace yet. Sign in on the web to create or join one, then come back."
      />
    );
  } else if (threads === null) {
    body = (
      <CenteredState
        symbol="exclamationmark.triangle"
        title="Conversations could not load"
        message="You may not have access to this inbox anymore."
      />
    );
  } else if (threads !== undefined && threads.length === 0) {
    body = (
      <CenteredState
        symbol="tray"
        title="You're all caught up"
        message={`No conversations in ${selected?.name ?? "this inbox"}. Tap the envelope above to simulate an incoming email.`}
      />
    );
  } else {
    body = (
      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={<FilterBar filter={filter} onChange={setFilter} />}
        ListEmptyComponent={
          <View style={styles.emptyFilter}>
            <Text style={styles.emptyFilterText}>
              No conversations match this filter.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setFilter("all")}
              hitSlop={8}
            >
              <Text style={styles.clearFilterText}>Clear filter</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item, index }) => (
          <ThreadListRow
            thread={item}
            first={index === 0}
            last={index === filtered.length - 1}
            onPress={() =>
              router.push({
                pathname: "/thread/[threadId]",
                params: { threadId: item._id },
              })
            }
          />
        )}
      />
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: selected?.name ?? "Inbox",
          headerLeft,
          headerRight,
        }}
      />
      {body}
    </>
  );
}

function FilterBar({
  filter,
  onChange,
}: {
  filter: Filter;
  onChange: (filter: Filter) => void;
}) {
  return (
    <View style={styles.filterBar} accessibilityRole="tablist">
      {FILTERS.map((item) => {
        const selected = item.key === filter;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(item.key)}
            style={[styles.filterChip, selected && styles.filterChipSelected]}
          >
            <Text
              style={[
                styles.filterChipText,
                selected && styles.filterChipTextSelected,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ThreadListRow({
  thread,
  first,
  last,
  onPress,
}: {
  thread: ThreadRow;
  first: boolean;
  last: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${thread.unread ? "Unread, " : ""}${thread.senderName}, ${thread.subject}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        first && styles.rowFirst,
        last && styles.rowLast,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.unreadColumn}>
        {thread.unread ? <View style={styles.unreadDot} /> : null}
      </View>
      <Avatar
        name={thread.senderName}
        imageUrl={thread.company?.logoUrl ?? undefined}
        size={36}
        online
      />
      <View style={styles.rowBody}>
        <View style={styles.rowTopLine}>
          <Text
            style={[styles.sender, thread.unread && styles.senderUnread]}
            numberOfLines={1}
          >
            {thread.senderName}
          </Text>
          <Text style={styles.time}>
            {formatRelativeTime(thread.lastMessageAt)}
          </Text>
        </View>
        <Text style={styles.subject} numberOfLines={1}>
          {thread.subject}
        </Text>
        <Text style={styles.preview} numberOfLines={2}>
          {thread.preview}
        </Text>
        {(thread.labels.length > 0 ||
          thread.assignee ||
          thread.priority === "urgent") && (
          <View style={styles.metaLine}>
            {thread.priority === "urgent" ? <UrgentPill /> : null}
            {thread.labels.map((label) => (
              <LabelPill key={label.name} name={label.name} color={label.color} />
            ))}
            <View style={styles.metaSpacer} />
            {thread.assignee ? (
              <View
                style={styles.assignee}
                accessibilityLabel={`Assigned to ${thread.assignee.name}`}
              >
                <Text style={styles.assigneeText}>
                  {getInitials(thread.assignee.name)}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </View>
      {!last ? <View style={styles.rowSeparator} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  dimmed: {
    opacity: 0.4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  filterBar: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 6,
    backgroundColor: colors.active,
  },
  filterChipSelected: {
    backgroundColor: colors.brandDark,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textSubtle,
    letterSpacing: -0.1,
  },
  filterChipTextSelected: {
    color: "#ffffff",
  },
  emptyFilter: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 48,
  },
  emptyFilterText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  clearFilterText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primaryText,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 12,
    paddingRight: 14,
    paddingLeft: 6,
  },
  rowFirst: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  rowLast: {
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  rowPressed: {
    backgroundColor: colors.active,
  },
  rowSeparator: {
    position: "absolute",
    left: 62,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
  },
  unreadColumn: {
    width: 14,
    alignItems: "center",
    paddingTop: 14,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTopLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sender: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: colors.text,
    letterSpacing: -0.2,
  },
  senderUnread: {
    fontWeight: "600",
    color: colors.textStrong,
  },
  time: {
    fontSize: 12,
    color: colors.textMuted,
  },
  subject: {
    fontSize: 14,
    color: colors.textSubtle,
    letterSpacing: -0.1,
  },
  preview: {
    fontSize: 13,
    lineHeight: 17,
    color: colors.textMuted,
  },
  metaLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    flexWrap: "wrap",
  },
  metaSpacer: {
    flex: 1,
  },
  assignee: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.active,
    alignItems: "center",
    justifyContent: "center",
  },
  assigneeText: {
    fontSize: 9,
    fontWeight: "600",
    color: colors.textSubtle,
  },
});

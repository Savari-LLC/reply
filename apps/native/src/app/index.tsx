import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@reply/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef } from "react";
import {
  ActionSheetIOS,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Avatar } from "@/components/avatar";
import {
  CenteredLoading,
  CenteredState,
} from "@/components/screen-states";
import {
  FALLBACK_ACCENTS,
  INBOX_ACCENTS,
  LABEL_ACCENTS,
  colors,
} from "@/theme";

type InboxRow = NonNullable<
  FunctionReturnType<typeof api.inbox.listInboxes>
>[number];

function inboxAccentDot(inbox: InboxRow, index: number): string {
  if (inbox.kind === "personal") return colors.primary;
  const slug = inbox.name.toLowerCase();
  const accent =
    INBOX_ACCENTS[slug] ?? FALLBACK_ACCENTS[index % FALLBACK_ACCENTS.length]!;
  return LABEL_ACCENTS[accent].dot;
}

export default function MailboxesScreen() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const currentUser = useQuery(api.users.getCurrent);
  const workspace = useQuery(api.workspaces.getCurrent);
  const inboxes = useQuery(api.inbox.listInboxes, workspace ? {} : "skip");
  const ensureSetup = useMutation(api.inbox.ensureSetup);

  // Idempotent per-session setup, mirroring the web app: guarantees the
  // signed-in member has a personal inbox.
  const setupRan = useRef(false);
  useEffect(() => {
    if (workspace && !setupRan.current) {
      setupRan.current = true;
      ensureSetup({}).catch(() => {
        setupRan.current = false;
      });
    }
  }, [workspace, ensureSetup]);

  const userName = currentUser?.name ?? currentUser?.username ?? "Signed in";
  const userImage =
    currentUser?.authProvider === "google"
      ? (currentUser.image ?? undefined)
      : undefined;

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

  const headerRight = () => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Account, signed in as ${userName}`}
      onPress={confirmSignOut}
      hitSlop={8}
    >
      <Avatar name={userName} imageUrl={userImage} size={30} online />
    </Pressable>
  );

  let body;
  if (workspace === undefined || (workspace && inboxes === undefined)) {
    body = <CenteredLoading label="Loading your inbox…" />;
  } else if (workspace === null) {
    body = (
      <CenteredState
        symbol="rectangle.stack.badge.person.crop"
        title="Finish setup on the web"
        message="Your account isn't part of a workspace yet. Sign in on the web to create or join one, then come back."
      />
    );
  } else {
    const rows = inboxes ?? [];
    const sections = [
      {
        title: "Your inbox",
        data: rows.filter((inbox) => inbox.kind === "personal"),
      },
      {
        title: "Shared inboxes",
        data: rows.filter((inbox) => inbox.kind !== "personal"),
      },
    ].filter((section) => section.data.length > 0);

    body = (
      <SectionList
        sections={sections}
        keyExtractor={(item) => item._id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.workspaceRow}>
            <Text style={styles.workspaceName}>{workspace.workspace.name}</Text>
            <Text style={styles.workspaceMeta}>
              {workspace.memberCount}{" "}
              {workspace.memberCount === 1 ? "member" : "members"}
            </Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title.toUpperCase()}</Text>
        )}
        renderItem={({ item, index, section }) => (
          <InboxListRow
            inbox={item}
            accent={inboxAccentDot(item, index)}
            first={index === 0}
            last={index === section.data.length - 1}
            onPress={() =>
              router.push({
                pathname: "/inbox/[inboxId]",
                params: { inboxId: item._id, name: item.name },
              })
            }
          />
        )}
        SectionSeparatorComponent={() => <View style={styles.sectionGap} />}
        stickySectionHeadersEnabled={false}
      />
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerRight }} />
      {body}
    </>
  );
}

function InboxListRow({
  inbox,
  accent,
  first,
  last,
  onPress,
}: {
  inbox: InboxRow;
  accent: string;
  first: boolean;
  last: boolean;
  onPress: () => void;
}) {
  const subtitle = inbox.channel
    ? inbox.channel.emailAddress
    : inbox.kind === "personal"
      ? "Only visible to you"
      : "No channel connected";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${inbox.name}, ${inbox.unreadCount} unread`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        first && styles.rowFirst,
        last && styles.rowLast,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: `${accent}1f` }]}>
        <SymbolView
          name={inbox.kind === "personal" ? "person.fill" : "tray.fill"}
          size={15}
          tintColor={accent}
        />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {inbox.name}
        </Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {inbox.unreadCount > 0 ? (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadBadgeText}>{inbox.unreadCount}</Text>
        </View>
      ) : null}
      <SymbolView
        name="chevron.right"
        size={13}
        weight="semibold"
        tintColor={colors.textMuted}
      />
      {!last ? <View style={styles.rowSeparator} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  workspaceRow: {
    paddingTop: 4,
    paddingBottom: 10,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  workspaceName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textSubtle,
    letterSpacing: -0.2,
  },
  workspaceMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    letterSpacing: 0.6,
    paddingHorizontal: 4,
    paddingBottom: 7,
  },
  sectionGap: {
    height: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 14,
    paddingVertical: 11,
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
    left: 56,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
  },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: {
    flex: 1,
    gap: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.textStrong,
    letterSpacing: -0.2,
  },
  rowSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  unreadBadge: {
    minWidth: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: "center",
  },
  unreadBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
});

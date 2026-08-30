import { api } from "@reply/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { SectionList, Pressable, StyleSheet, Text, View } from "react-native";

import { CenteredLoading } from "@/components/screen-states";
import { useInboxSelection } from "@/lib/inbox-selection";
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

/** Sidebar sheet: switch the mailbox shown on the main screen. */
export default function MailboxesSheet() {
  const router = useRouter();
  const { selected, select } = useInboxSelection();
  const workspace = useQuery(api.workspaces.getCurrent);
  const inboxes = useQuery(api.inbox.listInboxes);

  if (!inboxes || !workspace) {
    return <CenteredLoading label="Loading mailboxes…" />;
  }

  const sections = [
    {
      title: "Your inbox",
      data: inboxes.filter((inbox) => inbox.kind === "personal"),
    },
    {
      title: "Shared inboxes",
      data: inboxes.filter((inbox) => inbox.kind !== "personal"),
    },
  ].filter((section) => section.data.length > 0);

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item._id}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <View style={styles.workspaceRow}>
          <View style={styles.workspaceMark}>
            <SymbolView name="bubble.left.fill" size={13} tintColor="#ffffff" />
          </View>
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
      renderItem={({ item, index, section }) => {
        const isSelected = selected?.id === item._id;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${item.name}, ${item.unreadCount} unread`}
            onPress={() => {
              select({ id: item._id, name: item.name, kind: item.kind });
              Haptics.selectionAsync();
              router.back();
            }}
            style={({ pressed }) => [
              styles.row,
              index === 0 && styles.rowFirst,
              index === section.data.length - 1 && styles.rowLast,
              (pressed || isSelected) && styles.rowActive,
            ]}
          >
            <View
              style={[
                styles.rowIcon,
                { backgroundColor: `${inboxAccentDot(item, index)}1f` },
              ]}
            >
              <SymbolView
                name={item.kind === "personal" ? "person.fill" : "tray.fill"}
                size={15}
                tintColor={inboxAccentDot(item, index)}
              />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.rowSubtitle} numberOfLines={1}>
                {item.channels[0]?.address ??
                  (item.kind === "personal"
                    ? "Only visible to you"
                    : "No channel connected")}
              </Text>
            </View>
            {item.unreadCount > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
              </View>
            ) : null}
            {isSelected ? (
              <SymbolView
                name="checkmark"
                size={14}
                weight="semibold"
                tintColor={colors.primaryText}
              />
            ) : null}
            {index !== section.data.length - 1 ? (
              <View style={styles.rowSeparator} />
            ) : null}
          </Pressable>
        );
      }}
      SectionSeparatorComponent={() => <View style={styles.sectionGap} />}
      stickySectionHeadersEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 40,
  },
  workspaceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 16,
    paddingHorizontal: 4,
  },
  workspaceMark: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: colors.brandCoral,
    alignItems: "center",
    justifyContent: "center",
  },
  workspaceName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textStrong,
    letterSpacing: -0.3,
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
  rowActive: {
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

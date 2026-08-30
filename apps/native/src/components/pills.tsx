import { StyleSheet, Text, View } from "react-native";

import {
  LABEL_ACCENTS,
  LABEL_COLOR_ACCENTS,
  STATUS_LABELS,
  colors,
  type LabelAccent,
  type ThreadStatus,
} from "@/theme";

export function LabelPill({ name, color }: { name: string; color: string }) {
  const accent: LabelAccent = LABEL_COLOR_ACCENTS[color.toLowerCase()] ?? "blue";
  const style = LABEL_ACCENTS[accent];
  return (
    <View style={[styles.pill, { backgroundColor: style.bg }]}>
      <View style={[styles.dot, { backgroundColor: style.dot }]} />
      <Text style={[styles.pillText, { color: style.text }]} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

export function UrgentPill() {
  return (
    <View style={[styles.pill, { backgroundColor: colors.destructiveBg }]}>
      <Text style={[styles.pillText, { color: colors.destructive }]}>Urgent</Text>
    </View>
  );
}

export function StatusPill({ status }: { status: ThreadStatus }) {
  return (
    <View style={styles.statusPill}>
      <Text style={styles.statusText}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: -0.1,
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.textSubtle,
    letterSpacing: -0.1,
  },
});

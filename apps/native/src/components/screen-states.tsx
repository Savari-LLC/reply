import { SymbolView, type SFSymbol } from "expo-symbols";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors } from "@/theme";

export function CenteredLoading({ label }: { label: string }) {
  return (
    <View style={styles.container} accessibilityLabel={label} accessible>
      <ActivityIndicator size="small" color={colors.textMuted} />
      <Text style={styles.subtitle}>{label}</Text>
    </View>
  );
}

export function CenteredState({
  symbol,
  title,
  message,
  action,
}: {
  symbol: SFSymbol;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <SymbolView name={symbol} size={22} tintColor={colors.textSubtle} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.subtitle}>{message}</Text> : null}
      {action}
    </View>
  );
}

export function RetryButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
    >
      <Text style={styles.retryText}>Retry</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.active,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textStrong,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
  retry: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: colors.brandDark,
    paddingHorizontal: 20,
    paddingVertical: 9,
  },
  retryPressed: {
    backgroundColor: colors.brandDarkPressed,
  },
  retryText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
});

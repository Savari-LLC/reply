import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { getAvatarTint, getInitials } from "@/lib/format";
import { colors } from "@/theme";

export function Avatar({
  name,
  imageUrl,
  size = 32,
  online = false,
}: {
  name: string;
  imageUrl?: string;
  size?: number;
  online?: boolean;
}) {
  const dotSize = Math.max(8, Math.round(size * 0.28));
  return (
    <View style={{ width: size, height: size }}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View
          style={[
            styles.initials,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: getAvatarTint(name),
            },
          ]}
        >
          <Text
            style={[styles.initialsText, { fontSize: Math.round(size * 0.34) }]}
            allowFontScaling={false}
          >
            {getInitials(name)}
          </Text>
        </View>
      )}
      {online ? (
        <View
          style={[
            styles.onlineDot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  initials: {
    alignItems: "center",
    justifyContent: "center",
  },
  initialsText: {
    color: colors.text,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  onlineDot: {
    position: "absolute",
    right: -1,
    bottom: -1,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surfaceElevated,
  },
});

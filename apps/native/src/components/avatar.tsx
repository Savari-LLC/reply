import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { getAvatarTint, getInitials } from "@/lib/format";
import { colors } from "@/theme";

/**
 * People render as circular photos/initials. Company logos are usually wide
 * wordmarks, so `shape="logo"` renders them contained on a white rounded
 * square (matching the web thread list) instead of cropping them in a circle.
 */
export function Avatar({
  name,
  imageUrl,
  size = 32,
  online = false,
  shape = "circle",
}: {
  name: string;
  imageUrl?: string;
  size?: number;
  online?: boolean;
  shape?: "circle" | "logo";
}) {
  const dotSize = Math.max(8, Math.round(size * 0.28));
  const isLogo = shape === "logo" && imageUrl;
  return (
    <View style={{ width: size, height: size }}>
      {imageUrl ? (
        isLogo ? (
          <View
            style={[
              styles.logoFrame,
              { width: size, height: size, borderRadius: Math.round(size * 0.28) },
            ]}
          >
            <Image
              source={{ uri: imageUrl }}
              style={{ width: size - 10, height: size - 10 }}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
          </View>
        ) : (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        )
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
  logoFrame: {
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
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

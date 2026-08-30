import { oauth } from "@convex-dev/auth/providers/oauth/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { api } from "@reply/backend/convex/_generated/api";
import { ConvexReactClient, useConvexAuth } from "convex/react";
import { DefaultTheme, ThemeProvider } from "expo-router";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { colors } from "@/theme";

SplashScreen.preventAutoHideAsync();

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error(
    "EXPO_PUBLIC_CONVEX_URL is not set. Add it to apps/native/.env (see .env.example).",
  );
}

const convex = new ConvexReactClient(convexUrl, {
  unsavedChangesWarning: false,
});

/**
 * Persist auth tokens in the iOS keychain so the session survives app
 * restarts. Keys used by @convex-dev/auth only contain [A-Za-z0-9._-],
 * which SecureStore accepts.
 */
const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primaryText,
    background: colors.canvas,
    card: colors.surface,
    text: colors.textStrong,
    border: colors.border,
  },
};

export default function RootLayout() {
  return (
    <ConvexAuthProvider
      client={convex}
      api={api.auth}
      storage={secureStorage}
      ambientSignIns={[oauth()]}
    >
      <ThemeProvider value={navigationTheme}>
        <RootNavigator />
        <StatusBar style="dark" />
      </ThemeProvider>
    </ConvexAuthProvider>
  );
}

function RootNavigator() {
  const { isLoading, isAuthenticated } = useConvexAuth();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  // Keep the splash screen up until the stored session has been restored,
  // so signed-in users never flash the sign-in screen.
  if (isLoading) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primaryText,
        headerTitleStyle: { color: colors.textStrong },
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen
          name="index"
          options={{ title: "Mailboxes", headerLargeTitle: true }}
        />
        <Stack.Screen name="inbox/[inboxId]" options={{ title: "" }} />
        <Stack.Screen name="thread/[threadId]" options={{ title: "" }} />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
